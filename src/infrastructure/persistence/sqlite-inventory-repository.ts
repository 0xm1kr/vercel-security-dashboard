import type { InventoryRepository } from "../../application/ports/inventory-repository.js";
import type { Project } from "../../domain/inventory/project.js";
import type {
  EnvBinding,
  EnvBindingType,
  RotationStatus,
} from "../../domain/inventory/env-binding.js";
import type { DiffEvent, DiffKind } from "../../domain/inventory/diff-event.js";
import {
  EnvBindingId,
  ProjectId,
  RemoteEnvId,
  ScanId,
  TeamId,
} from "../../domain/shared/ids.js";
import { EnvKey } from "../../domain/shared/ids.js";
import { parseTargets } from "../../domain/shared/target.js";
import type { Db } from "./database.js";

interface ProjectRow {
  readonly id: string;
  readonly team_id: string;
  readonly name: string;
  readonly framework: string | null;
  readonly updated_at: number;
}

interface EnvBindingRow {
  readonly id: string;
  readonly remote_id: string;
  readonly team_id: string;
  readonly project_id: string;
  readonly key: string;
  readonly targets_json: string;
  readonly git_branch: string | null;
  readonly type: string;
  readonly remote_created_at: number | null;
  readonly remote_updated_at: number | null;
  readonly last_seen_scan_id: string;
  readonly rotation_status: string;
  readonly rotated_at: number | null;
}

interface DiffRow {
  readonly scan_id: string;
  readonly binding_id: string;
  readonly kind: string;
  readonly summary: string;
  readonly at: number;
}

const EMPTY_TARGETS: ReadonlyArray<unknown> = [];

const rowToProject = (row: ProjectRow): Project => ({
  id: ProjectId(row.id),
  teamId: TeamId(row.team_id),
  name: row.name,
  framework: row.framework,
  updatedAt: row.updated_at,
});

const parseTargetsJson = (raw: string): ReturnType<typeof parseTargets> => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parseTargets(Array.isArray(parsed) ? parsed : EMPTY_TARGETS);
  } catch {
    return parseTargets(EMPTY_TARGETS);
  }
};

const rowToBinding = (row: EnvBindingRow): EnvBinding => ({
  id: EnvBindingId(row.id),
  remoteId: RemoteEnvId(row.remote_id),
  teamId: TeamId(row.team_id),
  projectId: ProjectId(row.project_id),
  key: EnvKey(row.key),
  targets: parseTargetsJson(row.targets_json),
  gitBranch: row.git_branch,
  type: row.type as EnvBindingType,
  remoteCreatedAt: row.remote_created_at,
  remoteUpdatedAt: row.remote_updated_at,
  lastSeenScanId: ScanId(row.last_seen_scan_id),
  rotationStatus: row.rotation_status as RotationStatus,
  rotatedAt: row.rotated_at,
});

const rowToDiff = (row: DiffRow): DiffEvent => ({
  scanId: ScanId(row.scan_id),
  bindingId: EnvBindingId(row.binding_id),
  kind: row.kind as DiffKind,
  summary: row.summary,
  at: row.at,
});

export class SqliteInventoryRepository implements InventoryRepository {
  private readonly upsertProjectStmt;
  private readonly listProjectsStmt;
  private readonly getProjectStmt;
  private readonly upsertBindingStmt;
  private readonly listBindingsStmt;
  private readonly getBindingStmt;
  private readonly listStaleStmt;
  private readonly markSupersededStmt;
  private readonly insertDiffStmt;
  private readonly listDiffsStmt;
  private readonly recordRotationStmt;

  constructor(private readonly db: Db) {
    this.upsertProjectStmt = db.prepare(`
      INSERT INTO projects (id, team_id, name, framework, updated_at)
      VALUES (@id, @team_id, @name, @framework, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        team_id = excluded.team_id,
        name = excluded.name,
        framework = excluded.framework,
        updated_at = excluded.updated_at
    `);

    this.listProjectsStmt = db.prepare<[string]>(
      "SELECT * FROM projects WHERE team_id = ? ORDER BY name",
    );

    this.getProjectStmt = db.prepare<[string]>(
      "SELECT * FROM projects WHERE id = ?",
    );

    this.upsertBindingStmt = db.prepare(`
      INSERT INTO env_bindings (
        id, remote_id, team_id, project_id, key, targets_json,
        git_branch, type, remote_created_at, remote_updated_at,
        last_seen_scan_id, rotation_status, rotated_at
      ) VALUES (
        @id, @remote_id, @team_id, @project_id, @key, @targets_json,
        @git_branch, @type, @remote_created_at, @remote_updated_at,
        @last_seen_scan_id, @rotation_status, @rotated_at
      )
      ON CONFLICT(team_id, remote_id) DO UPDATE SET
        project_id = excluded.project_id,
        key = excluded.key,
        targets_json = excluded.targets_json,
        git_branch = excluded.git_branch,
        type = excluded.type,
        remote_created_at = excluded.remote_created_at,
        remote_updated_at = excluded.remote_updated_at,
        last_seen_scan_id = excluded.last_seen_scan_id,
        rotation_status = CASE
          WHEN env_bindings.rotation_status = 'superseded' THEN 'never'
          ELSE env_bindings.rotation_status
        END
    `);

    this.listBindingsStmt = db.prepare<[string]>(`
      SELECT * FROM env_bindings WHERE team_id = ? ORDER BY project_id, key
    `);

    this.getBindingStmt = db.prepare<[string]>(
      "SELECT * FROM env_bindings WHERE id = ?",
    );

    this.listStaleStmt = db.prepare<[string, string]>(
      "SELECT id FROM env_bindings WHERE team_id = ? AND last_seen_scan_id != ? AND rotation_status != 'superseded'",
    );

    this.markSupersededStmt = db.prepare<[string, string]>(
      "UPDATE env_bindings SET rotation_status = 'superseded' WHERE team_id = ? AND last_seen_scan_id != ?",
    );

    this.insertDiffStmt = db.prepare(`
      INSERT OR REPLACE INTO diff_events (scan_id, binding_id, kind, summary, at)
      VALUES (@scan_id, @binding_id, @kind, @summary, @at)
    `);

    this.listDiffsStmt = db.prepare<[string]>(
      "SELECT * FROM diff_events WHERE binding_id = ? ORDER BY at DESC",
    );

    this.recordRotationStmt = db.prepare<[number, string]>(
      "UPDATE env_bindings SET rotation_status = 'rotated', rotated_at = ? WHERE id = ?",
    );
  }

  async upsertProjects(projects: readonly Project[]): Promise<void> {
    const insertMany = this.db.transaction((rows: readonly Project[]) => {
      for (const p of rows) {
        this.upsertProjectStmt.run({
          id: p.id,
          team_id: p.teamId,
          name: p.name,
          framework: p.framework,
          updated_at: p.updatedAt,
        });
      }
    });
    insertMany(projects);
  }

  async listProjects(teamId: TeamId): Promise<readonly Project[]> {
    const rows = this.listProjectsStmt.all(teamId) as ProjectRow[];
    return rows.map(rowToProject);
  }

  async getProject(id: ProjectId): Promise<Project | null> {
    const row = this.getProjectStmt.get(id) as ProjectRow | undefined;
    return row === undefined ? null : rowToProject(row);
  }

  async upsertBindings(bindings: readonly EnvBinding[]): Promise<void> {
    const insertMany = this.db.transaction((rows: readonly EnvBinding[]) => {
      for (const b of rows) {
        this.upsertBindingStmt.run({
          id: b.id,
          remote_id: b.remoteId,
          team_id: b.teamId,
          project_id: b.projectId,
          key: b.key,
          targets_json: JSON.stringify(b.targets),
          git_branch: b.gitBranch,
          type: b.type,
          remote_created_at: b.remoteCreatedAt,
          remote_updated_at: b.remoteUpdatedAt,
          last_seen_scan_id: b.lastSeenScanId,
          rotation_status: b.rotationStatus,
          rotated_at: b.rotatedAt,
        });
      }
    });
    insertMany(bindings);
  }

  async listBindings(teamId: TeamId): Promise<readonly EnvBinding[]> {
    const rows = this.listBindingsStmt.all(teamId) as EnvBindingRow[];
    return rows.map(rowToBinding);
  }

  async getBinding(id: EnvBindingId): Promise<EnvBinding | null> {
    const row = this.getBindingStmt.get(id) as EnvBindingRow | undefined;
    return row === undefined ? null : rowToBinding(row);
  }

  async markStaleAsSuperseded(
    teamId: TeamId,
    currentScanId: string,
  ): Promise<readonly EnvBindingId[]> {
    const stale = (this.listStaleStmt.all(teamId, currentScanId) as { id: string }[]).map(
      (r) => EnvBindingId(r.id),
    );
    if (stale.length > 0) {
      this.markSupersededStmt.run(teamId, currentScanId);
    }
    return stale;
  }

  async appendDiffEvents(events: readonly DiffEvent[]): Promise<void> {
    const insertMany = this.db.transaction((rows: readonly DiffEvent[]) => {
      for (const e of rows) {
        this.insertDiffStmt.run({
          scan_id: e.scanId,
          binding_id: e.bindingId,
          kind: e.kind,
          summary: e.summary,
          at: e.at,
        });
      }
    });
    insertMany(events);
  }

  async listDiffEvents(bindingId: EnvBindingId): Promise<readonly DiffEvent[]> {
    const rows = this.listDiffsStmt.all(bindingId) as DiffRow[];
    return rows.map(rowToDiff);
  }

  async recordRotation(bindingId: EnvBindingId, rotatedAt: number): Promise<void> {
    this.recordRotationStmt.run(rotatedAt, bindingId);
  }
}
