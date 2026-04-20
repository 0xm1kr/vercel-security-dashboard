import type { EnvBindingId, ScanId } from "../shared/ids.js";

export type DiffKind = "added" | "removed" | "updated";

export interface DiffEvent {
  readonly scanId: ScanId;
  readonly bindingId: EnvBindingId;
  readonly kind: DiffKind;
  /** Short, value-free summary, e.g. "targets: [production] -> [production, preview]". */
  readonly summary: string;
  readonly at: number;
}
