/**
 * Provides the current time. Injected so tests can use a fake clock
 * and so the rest of the codebase never reads `Date.now()` directly.
 */
export interface Clock {
  now(): number;
}
