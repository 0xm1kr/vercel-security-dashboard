import type {
  EnvBindingId,
  EnvKey,
  ProjectId,
  RemoteEnvId,
  ScanId,
  TeamId,
} from "../shared/ids.js";
import type { Target } from "../shared/target.js";

/**
 * The Vercel API returns several env "types". We keep them as a
 * narrow union and a fallback string so unknown future values do not
 * crash the app.
 */
export type EnvBindingType =
  | "plain"
  | "secret"
  | "encrypted"
  | "system"
  | "sensitive"
  | "other";

export type RotationStatus = "never" | "rotated" | "superseded";

export interface EnvBinding {
  readonly id: EnvBindingId;
  readonly remoteId: RemoteEnvId;
  readonly teamId: TeamId;
  readonly projectId: ProjectId;
  readonly key: EnvKey;
  readonly targets: readonly Target[];
  readonly gitBranch: string | null;
  readonly type: EnvBindingType;
  readonly remoteCreatedAt: number | null;
  readonly remoteUpdatedAt: number | null;
  readonly lastSeenScanId: ScanId;
  readonly rotationStatus: RotationStatus;
  readonly rotatedAt: number | null;
}

/**
 * Stable hash of the metadata fields we track for a binding. Used by
 * the scanner to detect "changed" bindings between scans without
 * comparing every column. Excludes rotation fields, since those are
 * local state, not metadata from Vercel.
 */
export const bindingMetadataFingerprint = (
  binding: Pick<EnvBinding, "key" | "targets" | "gitBranch" | "type">,
): string => {
  const targets = [...binding.targets].join(",");
  return [binding.key, targets, binding.gitBranch ?? "", binding.type].join("|");
};
