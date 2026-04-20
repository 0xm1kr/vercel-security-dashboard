import { UnauthorizedError } from "../../domain/shared/errors.js";

interface Bucket {
  failures: number;
  lockedUntil: number;
  lastFailureAt: number;
}

const FAILURE_WINDOW_MS = 5 * 60 * 1000; // failures older than this fall off
const FREE_ATTEMPTS = 3; // first N failures incur no extra delay
const MAX_LOCKOUT_MS = 5 * 60 * 1000; // 5 minute cap

/**
 * Per-key (typically per-IP) login attempt throttle.
 *
 * Each consecutive failure beyond `FREE_ATTEMPTS` raises an
 * exponential cooldown: 2s, 4s, 8s, 16s, ... capped at 5 minutes.
 * A success clears the bucket. Failures older than `FAILURE_WINDOW_MS`
 * are forgiven.
 */
export class LoginThrottle {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Throws UnauthorizedError if the caller is currently locked out. */
  ensureAllowed(key: string): void {
    const b = this.buckets.get(key);
    if (b === undefined) return;
    const t = this.now();
    if (t - b.lastFailureAt > FAILURE_WINDOW_MS) {
      this.buckets.delete(key);
      return;
    }
    if (b.lockedUntil > t) {
      const seconds = Math.ceil((b.lockedUntil - t) / 1000);
      throw new UnauthorizedError(
        `Too many failed attempts. Try again in ${seconds}s.`,
      );
    }
  }

  /** Record a failed attempt and extend the lockout. */
  recordFailure(key: string): void {
    const t = this.now();
    const existing = this.buckets.get(key);
    const fresh =
      existing === undefined ||
      t - existing.lastFailureAt > FAILURE_WINDOW_MS;
    const failures = fresh ? 1 : existing.failures + 1;
    let lockoutMs = 0;
    if (failures > FREE_ATTEMPTS) {
      const exp = failures - FREE_ATTEMPTS; // 1, 2, 3, ...
      lockoutMs = Math.min(MAX_LOCKOUT_MS, 1000 * 2 ** exp);
    }
    this.buckets.set(key, {
      failures,
      lastFailureAt: t,
      lockedUntil: t + lockoutMs,
    });
  }

  recordSuccess(key: string): void {
    this.buckets.delete(key);
  }

  /** Test-only: forget all state. */
  reset(): void {
    this.buckets.clear();
  }
}
