import { ValidationError } from "./errors.js";

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type TeamId = Brand<string, "TeamId">;
export type ProjectId = Brand<string, "ProjectId">;
export type EnvBindingId = Brand<string, "EnvBindingId">;
export type RemoteEnvId = Brand<string, "RemoteEnvId">;
export type ScanId = Brand<string, "ScanId">;
export type RotationEventId = Brand<string, "RotationEventId">;
export type VendorId = Brand<string, "VendorId">;

const requireNonEmpty = (label: string, value: unknown): string => {
  if (typeof value !== "string") {
    throw new ValidationError(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${label} must not be empty`);
  }
  return trimmed;
};

export const TeamId = (raw: unknown): TeamId =>
  requireNonEmpty("TeamId", raw) as TeamId;

export const ProjectId = (raw: unknown): ProjectId =>
  requireNonEmpty("ProjectId", raw) as ProjectId;

export const EnvBindingId = (raw: unknown): EnvBindingId =>
  requireNonEmpty("EnvBindingId", raw) as EnvBindingId;

export const RemoteEnvId = (raw: unknown): RemoteEnvId =>
  requireNonEmpty("RemoteEnvId", raw) as RemoteEnvId;

export const ScanId = (raw: unknown): ScanId =>
  requireNonEmpty("ScanId", raw) as ScanId;

export const RotationEventId = (raw: unknown): RotationEventId =>
  requireNonEmpty("RotationEventId", raw) as RotationEventId;

export const VendorId = (raw: unknown): VendorId =>
  requireNonEmpty("VendorId", raw) as VendorId;

export type EnvKey = Brand<string, "EnvKey">;

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const EnvKey = (raw: unknown): EnvKey => {
  const value = requireNonEmpty("EnvKey", raw);
  if (!ENV_KEY_PATTERN.test(value)) {
    throw new ValidationError(
      `EnvKey "${value}" is not a valid environment variable name`,
    );
  }
  return value as EnvKey;
};
