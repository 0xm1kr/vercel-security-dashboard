import type { ProjectId, TeamId } from "../shared/ids.js";

export interface Project {
  readonly id: ProjectId;
  readonly teamId: TeamId;
  readonly name: string;
  readonly framework: string | null;
  readonly updatedAt: number;
}
