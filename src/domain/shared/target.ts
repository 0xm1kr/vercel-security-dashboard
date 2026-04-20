import { ValidationError } from "./errors.js";

/**
 * Vercel deployment targets that an environment variable can apply to.
 * Mirrors the values returned by the Vercel REST API.
 */
export const ALL_TARGETS = ["production", "preview", "development"] as const;
export type Target = (typeof ALL_TARGETS)[number];

const TARGET_SET = new Set<string>(ALL_TARGETS);

export const isTarget = (raw: unknown): raw is Target =>
  typeof raw === "string" && TARGET_SET.has(raw);

export const parseTarget = (raw: unknown): Target => {
  if (!isTarget(raw)) {
    throw new ValidationError(`"${String(raw)}" is not a valid Vercel target`);
  }
  return raw;
};

export const parseTargets = (raw: unknown): Target[] => {
  if (!Array.isArray(raw)) {
    throw new ValidationError("targets must be an array");
  }
  const seen = new Set<Target>();
  for (const value of raw) {
    seen.add(parseTarget(value));
  }
  // Stable, canonical ordering for storage and comparison.
  return ALL_TARGETS.filter((t) => seen.has(t));
};

export const targetsEqual = (a: readonly Target[], b: readonly Target[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};
