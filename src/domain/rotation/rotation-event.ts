import type { EnvBindingId, RotationEventId } from "../shared/ids.js";

export interface RotationEvent {
  readonly id: RotationEventId;
  readonly bindingId: EnvBindingId;
  readonly at: number;
  readonly success: boolean;
  /** HTTP status from the upstream Vercel call, if any. */
  readonly status: number | null;
  /** Human-safe error message; never contains the new secret value. */
  readonly errorMessage: string | null;
  readonly note: string | null;
}
