import type { Project } from "../../domain/inventory/project.js";
import type { EnvBinding } from "../../domain/inventory/env-binding.js";
import type { DiffEvent } from "../../domain/inventory/diff-event.js";
import type {
  EnvBindingId,
  ProjectId,
  TeamId,
} from "../../domain/shared/ids.js";

export interface InventoryRepository {
  upsertProjects(projects: readonly Project[]): Promise<void>;
  listProjects(teamId: TeamId): Promise<readonly Project[]>;
  getProject(id: ProjectId): Promise<Project | null>;

  upsertBindings(bindings: readonly EnvBinding[]): Promise<void>;
  listBindings(teamId: TeamId): Promise<readonly EnvBinding[]>;
  getBinding(id: EnvBindingId): Promise<EnvBinding | null>;

  /**
   * Mark bindings whose `lastSeenScanId` is older than `currentScanId`
   * as `superseded` (no longer present on Vercel as of this scan).
   * Idempotent.
   */
  markStaleAsSuperseded(
    teamId: TeamId,
    currentScanId: string,
  ): Promise<readonly EnvBindingId[]>;

  appendDiffEvents(events: readonly DiffEvent[]): Promise<void>;
  listDiffEvents(bindingId: EnvBindingId): Promise<readonly DiffEvent[]>;

  /**
   * Update rotation status / timestamp after a successful rotation.
   */
  recordRotation(
    bindingId: EnvBindingId,
    rotatedAt: number,
  ): Promise<void>;
}
