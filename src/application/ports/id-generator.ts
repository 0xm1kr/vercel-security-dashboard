/**
 * Generates opaque, unguessable identifiers used as primary keys for
 * local entities (scans, rotation events, env binding rows).
 */
export interface IdGenerator {
  next(): string;
}
