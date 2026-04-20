import type { RotationEvent } from "../../domain/rotation/rotation-event.js";
import type { EnvBindingId } from "../../domain/shared/ids.js";

export interface RotationRepository {
  append(event: RotationEvent): Promise<void>;
  listForBinding(bindingId: EnvBindingId): Promise<readonly RotationEvent[]>;
  listRecent(limit: number): Promise<readonly RotationEvent[]>;
}
