import type { Db } from "./database.js";

interface Migration {
  readonly version: number;
  readonly up: string;
}

/**
 * Migrations are append-only. Never edit a previously-released
 * migration; add a new one with the next version number.
 */
const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE projects (
        id           TEXT PRIMARY KEY,
        team_id      TEXT NOT NULL,
        name         TEXT NOT NULL,
        framework    TEXT,
        updated_at   INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_projects_team ON projects(team_id);

      CREATE TABLE env_bindings (
        id                 TEXT PRIMARY KEY,
        remote_id          TEXT NOT NULL,
        team_id            TEXT NOT NULL,
        project_id         TEXT NOT NULL,
        key                TEXT NOT NULL,
        targets_json       TEXT NOT NULL,
        git_branch         TEXT,
        type               TEXT NOT NULL,
        remote_created_at  INTEGER,
        remote_updated_at  INTEGER,
        last_seen_scan_id  TEXT NOT NULL,
        rotation_status    TEXT NOT NULL DEFAULT 'never',
        rotated_at         INTEGER,
        UNIQUE(team_id, remote_id),
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_env_bindings_project ON env_bindings(project_id, key);
      CREATE INDEX idx_env_bindings_status ON env_bindings(rotation_status);
      CREATE INDEX idx_env_bindings_last_scan ON env_bindings(last_seen_scan_id);

      CREATE TABLE scans (
        id                TEXT PRIMARY KEY,
        team_id           TEXT NOT NULL,
        started_at        INTEGER NOT NULL,
        finished_at       INTEGER,
        status            TEXT NOT NULL,
        projects_scanned  INTEGER NOT NULL DEFAULT 0,
        bindings_seen     INTEGER NOT NULL DEFAULT 0,
        error_message     TEXT
      );
      CREATE INDEX idx_scans_team_started ON scans(team_id, started_at DESC);

      CREATE TABLE diff_events (
        scan_id     TEXT NOT NULL,
        binding_id  TEXT NOT NULL,
        kind        TEXT NOT NULL,
        summary     TEXT NOT NULL,
        at          INTEGER NOT NULL,
        PRIMARY KEY(scan_id, binding_id, kind),
        FOREIGN KEY(scan_id) REFERENCES scans(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_diff_events_binding ON diff_events(binding_id, at DESC);

      CREATE TABLE rotation_events (
        id             TEXT PRIMARY KEY,
        binding_id     TEXT NOT NULL,
        at             INTEGER NOT NULL,
        success        INTEGER NOT NULL,
        status         INTEGER,
        error_message  TEXT,
        note           TEXT
      );
      CREATE INDEX idx_rotation_events_binding ON rotation_events(binding_id, at DESC);
    `,
  },
];

const ensureSchemaTable = (db: Db): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
};

export const runMigrations = (db: Db): void => {
  ensureSchemaTable(db);
  const stmt = db.prepare<[number]>(
    "SELECT 1 FROM schema_migrations WHERE version = ?",
  );
  const insert = db.prepare<[number, number]>(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
  );

  for (const migration of MIGRATIONS) {
    if (stmt.get(migration.version) !== undefined) continue;
    db.transaction(() => {
      db.exec(migration.up);
      insert.run(migration.version, Date.now());
    })();
  }
};
