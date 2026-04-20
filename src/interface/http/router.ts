import { dashboardHandler } from "./handlers/dashboard.js";
import { healthHandler } from "./handlers/health.js";
import {
  listTeamsHandler,
  mintScopedTokenHandler,
  resetOnboardingHandler,
  saveOnboardingHandler,
  verifyTokenHandler,
} from "./handlers/onboarding.js";
import { profileHandler } from "./handlers/profile.js";
import { rotateBindingHandler } from "./handlers/rotate.js";
import { runScanHandler } from "./handlers/scan.js";
import {
  lockSessionHandler,
  unlockSessionHandler,
} from "./handlers/session.js";
import type { Handler } from "./handlers/types.js";

interface Route {
  readonly method: string;
  readonly pattern: RegExp;
  readonly paramNames: readonly string[];
  readonly handler: Handler;
}

const compile = (path: string): { pattern: RegExp; paramNames: string[] } => {
  const paramNames: string[] = [];
  const escaped = path
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { pattern: new RegExp(`^${escaped}/?$`), paramNames };
};

const route = (method: string, path: string, handler: Handler): Route => {
  const { pattern, paramNames } = compile(path);
  return { method, pattern, paramNames, handler };
};

export const apiRoutes: readonly Route[] = [
  route("GET", "/api/health", healthHandler),
  route("GET", "/api/profile", profileHandler),
  route("POST", "/api/onboarding/verify", verifyTokenHandler),
  route("POST", "/api/onboarding/teams", listTeamsHandler),
  route("POST", "/api/onboarding/save", saveOnboardingHandler),
  route("POST", "/api/onboarding/mint", mintScopedTokenHandler),
  route("POST", "/api/onboarding/reset", resetOnboardingHandler),
  route("POST", "/api/session/unlock", unlockSessionHandler),
  route("POST", "/api/session/lock", lockSessionHandler),
  route("POST", "/api/scan", runScanHandler),
  route("GET", "/api/dashboard", dashboardHandler),
  route("POST", "/api/bindings/:id/rotate", rotateBindingHandler),
];

export interface MatchedRoute {
  readonly handler: Handler;
  readonly params: Map<string, string>;
}

export const matchRoute = (
  method: string,
  pathname: string,
): MatchedRoute | null => {
  for (const r of apiRoutes) {
    if (r.method !== method) continue;
    const match = r.pattern.exec(pathname);
    if (match === null) continue;
    const params = new Map<string, string>();
    for (let i = 0; i < r.paramNames.length; i++) {
      const name = r.paramNames[i];
      const value = match[i + 1];
      if (name !== undefined && value !== undefined) {
        params.set(name, decodeURIComponent(value));
      }
    }
    return { handler: r.handler, params };
  }
  return null;
};
