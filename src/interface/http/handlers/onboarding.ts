import {
  asObject,
  optionalBoolean,
  optionalString,
  readJsonBody,
  requireString,
} from "../validation.js";
import {
  buildClearedSessionCookie,
} from "../session.js";
import { ValidationError } from "../../../domain/shared/errors.js";
import type { Handler } from "./types.js";

export const verifyTokenHandler: Handler = async ({ req, ctx }) => {
  const body = asObject(await readJsonBody(req));
  const token = requireString(body, "token");
  const result = await ctx.verifyCredentials.execute(token);
  if (!result.ok) {
    return {
      type: "json",
      status: 200,
      body: { ok: false, reason: result.error.reason, message: result.error.message },
    };
  }
  return {
    type: "json",
    body: {
      ok: true,
      user: {
        id: result.value.id,
        username: result.value.username,
        email: result.value.email,
      },
    },
  };
};

export const listTeamsHandler: Handler = async ({ req, ctx }) => {
  const body = asObject(await readJsonBody(req));
  const token = requireString(body, "token");
  const teams = await ctx.listTeams.execute(token);
  return {
    type: "json",
    body: {
      teams: teams.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    },
  };
};

export const saveOnboardingHandler: Handler = async ({ req, ctx }) => {
  const body = asObject(await readJsonBody(req));
  const passphrase = requireString(body, "passphrase");
  const token = requireString(body, "token");
  const teamId = requireString(body, "teamId");
  const teamName = optionalString(body, "teamName") ?? "";
  const replaceExisting = optionalBoolean(body, "replaceExisting") ?? false;
  await ctx.saveOnboarding.execute({
    passphrase,
    token,
    teamId,
    teamName,
    replaceExisting,
  });
  return { type: "json", body: { ok: true } };
};

export const mintScopedTokenHandler: Handler = async ({ req, ctx }) => {
  const body = asObject(await readJsonBody(req));
  const passphrase = requireString(body, "passphrase");
  const bootstrapToken = requireString(body, "bootstrapToken");
  const teamId = optionalString(body, "teamId");
  const tokenName = optionalString(body, "tokenName") ?? "vercel-security-dashboard";
  const replaceExisting = optionalBoolean(body, "replaceExisting") ?? false;
  if (tokenName.trim().length === 0) {
    throw new ValidationError("tokenName must not be blank");
  }
  const result = await ctx.mintScopedToken.execute({
    passphrase,
    bootstrapToken,
    teamId,
    tokenName,
    replaceExisting,
  });
  return { type: "json", body: { ok: true, ...result } };
};

/**
 * Wipes the encrypted Vercel token and the connection profile, and
 * destroys the active session. Inventory / scan history is intentionally
 * preserved — only the *credentials* are reset, so the user can re-onboard
 * without losing audit trail.
 */
export const resetOnboardingHandler: Handler = async ({ ctx, sessionId }) => {
  ctx.sessions.destroy(sessionId);
  await ctx.credentials.clear();
  return {
    type: "json",
    body: { ok: true },
    headers: { "Set-Cookie": buildClearedSessionCookie() },
  };
};
