import type { EnvBinding } from "../../domain/inventory/env-binding.js";
import type { RotationEvent } from "../../domain/rotation/rotation-event.js";
import {
  EnvBindingId,
  RotationEventId,
  type TeamId,
} from "../../domain/shared/ids.js";
import { NotFoundError, ValidationError } from "../../domain/shared/errors.js";
import { parseTargets, type Target } from "../../domain/shared/target.js";
import type { Clock } from "../ports/clock.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { InventoryRepository } from "../ports/inventory-repository.js";
import type { RotationRepository } from "../ports/rotation-repository.js";
import type { VercelPort } from "../ports/vercel-port.js";

export interface RotateBindingInput {
  readonly token: string;
  readonly teamId: TeamId;
  readonly bindingId: string;
  /**
   * The new value as a Buffer so we can wipe it after the request.
   * Callers (HTTP handler) construct it from the parsed body and
   * must hand off ownership to this use case.
   */
  readonly newValue: Buffer;
  readonly targets: readonly Target[] | null;
  readonly note: string | null;
  /**
   * If true (the default), upgrade the env type to `"sensitive"` on
   * Vercel as part of the rotation. Sensitive vars are encrypted at
   * rest by Vercel and never returned in subsequent reads, which is
   * the right default whenever a user is rotating a key. The flag is
   * ignored for `system` bindings (which Vercel won't accept writes
   * for in the first place).
   */
  readonly markSensitive: boolean;
}

export interface RotateBindingResult {
  readonly bindingId: string;
  readonly rotatedAt: number;
  readonly status: number;
}

const ensureTargetsAllowed = (
  binding: EnvBinding,
  requested: readonly Target[] | null,
): readonly Target[] => {
  if (requested === null || requested.length === 0) {
    return binding.targets;
  }
  const allowed = new Set<string>(binding.targets);
  for (const t of requested) {
    if (!allowed.has(t)) {
      throw new ValidationError(
        `Target "${t}" is not associated with this binding`,
      );
    }
  }
  return parseTargets(requested);
};

/**
 * Rotates a single env binding. The new value is held in a Buffer
 * for the duration of the upstream call and zeroed in `finally`,
 * regardless of success or failure. The new value is never persisted
 * locally; only an audit row is appended.
 */
export class RotateEnvBindingUseCase {
  constructor(
    private readonly vercel: VercelPort,
    private readonly inventory: InventoryRepository,
    private readonly rotations: RotationRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RotateBindingInput): Promise<RotateBindingResult> {
    const bindingId = EnvBindingId(input.bindingId);
    const binding = await this.inventory.getBinding(bindingId);
    if (binding === null) {
      input.newValue.fill(0);
      throw new NotFoundError("Env binding not found");
    }
    if (binding.teamId !== input.teamId) {
      input.newValue.fill(0);
      throw new NotFoundError("Env binding not found");
    }
    if (binding.rotationStatus === "superseded") {
      input.newValue.fill(0);
      throw new ValidationError(
        "This binding no longer exists on Vercel; rescan before rotating",
      );
    }

    const targets = ensureTargetsAllowed(binding, input.targets);
    const upstreamType =
      input.markSensitive && binding.type !== "system"
        ? "sensitive"
        : binding.type;

    let status = 0;
    let success = false;
    let errorMessage: string | null = null;
    try {
      status = await this.vercel.updateEnvValue(input.token, {
        teamId: binding.teamId,
        projectId: binding.projectId,
        remoteId: binding.remoteId,
        key: binding.key,
        type: upstreamType,
        targets,
        gitBranch: binding.gitBranch,
        value: input.newValue,
      });
      success = status >= 200 && status < 300;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "rotation failed";
      throw err;
    } finally {
      input.newValue.fill(0);

      const at = this.clock.now();
      const event: RotationEvent = {
        id: RotationEventId(this.ids.next()),
        bindingId,
        at,
        success,
        status: status === 0 ? null : status,
        errorMessage,
        note: input.note,
      };
      try {
        await this.rotations.append(event);
        if (success) {
          await this.inventory.recordRotation(bindingId, at);
        }
      } catch {
        // Audit/persist errors must not cause the original error to
        // be swallowed. Surface the original via the outer throw.
      }
    }

    return {
      bindingId: binding.id,
      rotatedAt: this.clock.now(),
      status,
    };
  }
}
