import type { ScanId, TeamId } from "../shared/ids.js";

export type ScanStatus = "running" | "succeeded" | "failed";

export interface Scan {
  readonly id: ScanId;
  readonly teamId: TeamId;
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly status: ScanStatus;
  readonly projectsScanned: number;
  readonly bindingsSeen: number;
  readonly errorMessage: string | null;
}
