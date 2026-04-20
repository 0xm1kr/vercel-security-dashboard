import type { ScanRepository } from "../../application/ports/scan-repository.js";
import type { Scan, ScanStatus } from "../../domain/inventory/scan.js";
import { ScanId, TeamId } from "../../domain/shared/ids.js";
import type { Db } from "./database.js";

interface ScanRow {
  readonly id: string;
  readonly team_id: string;
  readonly started_at: number;
  readonly finished_at: number | null;
  readonly status: string;
  readonly projects_scanned: number;
  readonly bindings_seen: number;
  readonly error_message: string | null;
}

const rowToScan = (row: ScanRow): Scan => ({
  id: ScanId(row.id),
  teamId: TeamId(row.team_id),
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  status: row.status as ScanStatus,
  projectsScanned: row.projects_scanned,
  bindingsSeen: row.bindings_seen,
  errorMessage: row.error_message,
});

export class SqliteScanRepository implements ScanRepository {
  private readonly insertStmt;
  private readonly finishStmt;
  private readonly getStmt;
  private readonly listRecentStmt;

  constructor(db: Db) {
    this.insertStmt = db.prepare(`
      INSERT INTO scans (id, team_id, started_at, status, projects_scanned, bindings_seen)
      VALUES (@id, @team_id, @started_at, @status, 0, 0)
    `);
    this.finishStmt = db.prepare(`
      UPDATE scans SET
        finished_at = @finished_at,
        status = @status,
        projects_scanned = @projects_scanned,
        bindings_seen = @bindings_seen,
        error_message = @error_message
      WHERE id = @id
    `);
    this.getStmt = db.prepare<[string]>("SELECT * FROM scans WHERE id = ?");
    this.listRecentStmt = db.prepare<[string, number]>(
      "SELECT * FROM scans WHERE team_id = ? ORDER BY started_at DESC LIMIT ?",
    );
  }

  async start(scan: Scan): Promise<void> {
    this.insertStmt.run({
      id: scan.id,
      team_id: scan.teamId,
      started_at: scan.startedAt,
      status: scan.status,
    });
  }

  async finish(
    id: ScanId,
    status: ScanStatus,
    finishedAt: number,
    projectsScanned: number,
    bindingsSeen: number,
    errorMessage: string | null,
  ): Promise<void> {
    this.finishStmt.run({
      id,
      status,
      finished_at: finishedAt,
      projects_scanned: projectsScanned,
      bindings_seen: bindingsSeen,
      error_message: errorMessage,
    });
  }

  async get(id: ScanId): Promise<Scan | null> {
    const row = this.getStmt.get(id) as ScanRow | undefined;
    return row === undefined ? null : rowToScan(row);
  }

  async listRecent(teamId: TeamId, limit: number): Promise<readonly Scan[]> {
    const rows = this.listRecentStmt.all(teamId, limit) as ScanRow[];
    return rows.map(rowToScan);
  }
}
