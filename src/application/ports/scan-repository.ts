import type { Scan, ScanStatus } from "../../domain/inventory/scan.js";
import type { ScanId, TeamId } from "../../domain/shared/ids.js";

export interface ScanRepository {
  start(scan: Scan): Promise<void>;
  finish(
    id: ScanId,
    status: ScanStatus,
    finishedAt: number,
    projectsScanned: number,
    bindingsSeen: number,
    errorMessage: string | null,
  ): Promise<void>;
  get(id: ScanId): Promise<Scan | null>;
  listRecent(teamId: TeamId, limit: number): Promise<readonly Scan[]>;
}
