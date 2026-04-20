import type { RotationRepository } from "../../application/ports/rotation-repository.js";
import type { RotationEvent } from "../../domain/rotation/rotation-event.js";
import { EnvBindingId, RotationEventId } from "../../domain/shared/ids.js";
import type { Db } from "./database.js";

interface RotationRow {
  readonly id: string;
  readonly binding_id: string;
  readonly at: number;
  readonly success: number;
  readonly status: number | null;
  readonly error_message: string | null;
  readonly note: string | null;
}

const rowToEvent = (row: RotationRow): RotationEvent => ({
  id: RotationEventId(row.id),
  bindingId: EnvBindingId(row.binding_id),
  at: row.at,
  success: row.success === 1,
  status: row.status,
  errorMessage: row.error_message,
  note: row.note,
});

export class SqliteRotationRepository implements RotationRepository {
  private readonly insertStmt;
  private readonly listForBindingStmt;
  private readonly listRecentStmt;

  constructor(db: Db) {
    this.insertStmt = db.prepare(`
      INSERT INTO rotation_events (id, binding_id, at, success, status, error_message, note)
      VALUES (@id, @binding_id, @at, @success, @status, @error_message, @note)
    `);
    this.listForBindingStmt = db.prepare<[string]>(
      "SELECT * FROM rotation_events WHERE binding_id = ? ORDER BY at DESC",
    );
    this.listRecentStmt = db.prepare<[number]>(
      "SELECT * FROM rotation_events ORDER BY at DESC LIMIT ?",
    );
  }

  async append(event: RotationEvent): Promise<void> {
    this.insertStmt.run({
      id: event.id,
      binding_id: event.bindingId,
      at: event.at,
      success: event.success ? 1 : 0,
      status: event.status,
      error_message: event.errorMessage,
      note: event.note,
    });
  }

  async listForBinding(bindingId: EnvBindingId): Promise<readonly RotationEvent[]> {
    const rows = this.listForBindingStmt.all(bindingId) as RotationRow[];
    return rows.map(rowToEvent);
  }

  async listRecent(limit: number): Promise<readonly RotationEvent[]> {
    const rows = this.listRecentStmt.all(limit) as RotationRow[];
    return rows.map(rowToEvent);
  }
}
