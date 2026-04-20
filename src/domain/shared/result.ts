/**
 * Lightweight Result type used at boundaries where throwing would be
 * misleading (e.g. credential verification, where a 401 from Vercel is
 * an expected outcome, not an exception).
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });
