import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runMigrations } from "./migrations.js";

export type Db = Database.Database;

/**
 * Open (or create) the SQLite database file used for inventory and
 * audit. Always runs pending migrations before returning, so callers
 * can assume the schema is up to date.
 */
export const openDatabase = (filePath: string): Db => {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
};
