import type { Project } from "../../domain/inventory/project.js";
import type {
  EnvBinding,
  EnvBindingType,
} from "../../domain/inventory/env-binding.js";
import type { TeamId, ProjectId } from "../../domain/shared/ids.js";
import type { Target } from "../../domain/shared/target.js";

export interface VercelTeamSummary {
  readonly id: TeamId;
  readonly name: string;
  readonly slug: string;
}

export interface VercelUser {
  readonly id: string;
  readonly username: string;
  readonly email: string | null;
}

/**
 * Returned by the scanner port when listing env bindings for a
 * project. Domain `EnvBinding` requires a `lastSeenScanId`, which the
 * scanner attaches; the gateway only knows what Vercel returned.
 */
export interface RemoteEnvBinding {
  readonly remoteId: string;
  readonly key: string;
  readonly targets: readonly Target[];
  readonly gitBranch: string | null;
  readonly type: EnvBindingType;
  readonly remoteCreatedAt: number | null;
  readonly remoteUpdatedAt: number | null;
}

export interface UpsertEnvValueInput {
  readonly teamId: TeamId;
  readonly projectId: ProjectId;
  readonly remoteId: string;
  readonly key: string;
  readonly type: EnvBindingType;
  readonly targets: readonly Target[];
  readonly gitBranch: string | null;
  /**
   * The new value as a Buffer so we can zero it after the request.
   * Implementations must not copy this into a string field that
   * outlives the call.
   */
  readonly value: Buffer;
}

/**
 * Single port covering all Vercel REST calls. Kept as one interface
 * because the application layer composes them as one upstream
 * dependency, and DRY (one auth/header path) reads better that way.
 */
export interface VercelPort {
  getCurrentUser(token: string): Promise<VercelUser>;
  listTeams(token: string): Promise<readonly VercelTeamSummary[]>;
  listProjects(token: string, teamId: TeamId): Promise<readonly Project[]>;
  listEnvBindings(
    token: string,
    teamId: TeamId,
    projectId: ProjectId,
  ): Promise<readonly RemoteEnvBinding[]>;
  /**
   * Replace the value of an existing environment variable on Vercel.
   * Returns the HTTP status (200 on success). Implementations must
   * not log the request body.
   */
  updateEnvValue(token: string, input: UpsertEnvValueInput): Promise<number>;

  /**
   * Mint a new auth token using an existing valid bearer. Optional
   * for the dashboard onboarding wizard (Phase 5b).
   */
  createAuthToken(
    token: string,
    name: string,
    teamId: TeamId | null,
  ): Promise<string>;
}
