import type { IncomingMessage, ServerResponse } from "node:http";
import type { CredentialStore } from "../../../application/ports/credential-store.js";
import type { GetDashboardDataUseCase } from "../../../application/inventory/get-dashboard-data.js";
import type { ListTeamsUseCase } from "../../../application/onboarding/list-teams.js";
import type { MintScopedTokenUseCase } from "../../../application/onboarding/mint-scoped-token.js";
import type { RotateEnvBindingUseCase } from "../../../application/rotation/rotate-binding.js";
import type { RunScanUseCase } from "../../../application/inventory/run-scan.js";
import type { SaveOnboardingUseCase } from "../../../application/onboarding/save-onboarding.js";
import type { VerifyCredentialsUseCase } from "../../../application/onboarding/verify-credentials.js";
import type { SessionStore } from "../session.js";
import type { LoginThrottle } from "../throttle.js";

export interface AppContext {
  readonly credentials: CredentialStore;
  readonly sessions: SessionStore;
  readonly unlockThrottle: LoginThrottle;
  readonly verifyCredentials: VerifyCredentialsUseCase;
  readonly listTeams: ListTeamsUseCase;
  readonly saveOnboarding: SaveOnboardingUseCase;
  readonly mintScopedToken: MintScopedTokenUseCase;
  readonly runScan: RunScanUseCase;
  readonly getDashboardData: GetDashboardDataUseCase;
  readonly rotateBinding: RotateEnvBindingUseCase;
}

export interface HandlerArgs {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly url: URL;
  readonly params: ReadonlyMap<string, string>;
  readonly ctx: AppContext;
  readonly sessionId: string | null;
}

export type HandlerResult =
  | { type: "json"; status?: number; body: unknown; headers?: Record<string, string> }
  | { type: "noContent"; headers?: Record<string, string> };

export type Handler = (args: HandlerArgs) => Promise<HandlerResult>;
