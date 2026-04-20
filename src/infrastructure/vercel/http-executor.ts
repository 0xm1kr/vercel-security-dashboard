import { IntegrationError, UnauthorizedError } from "../../domain/shared/errors.js";
import { VERCEL_API_BASE } from "./routes.js";

export interface VercelHttpOptions {
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  readonly body?: unknown;
  readonly token: string;
  readonly retries?: number;
  readonly timeoutMs?: number;
}

export interface VercelHttpResponse<T> {
  readonly status: number;
  readonly body: T;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 20_000;
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const computeBackoff = (attempt: number, retryAfter: string | null): number => {
  if (retryAfter !== null) {
    const asInt = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(asInt) && asInt >= 0) {
      return Math.min(asInt * 1000, 30_000);
    }
  }
  // Exponential backoff with a small jitter, capped at 8s.
  const base = Math.min(2 ** attempt * 250, 8_000);
  return base + Math.floor(Math.random() * 250);
};

const safeReadBody = async (
  response: Response,
): Promise<{ json: unknown; text: string }> => {
  const text = await response.text();
  if (text.length === 0) return { json: null, text: "" };
  try {
    return { json: JSON.parse(text) as unknown, text };
  } catch {
    return { json: null, text };
  }
};

const extractApiMessage = (json: unknown, text: string): string => {
  if (json !== null && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    const error = obj["error"];
    if (error !== null && typeof error === "object") {
      const message = (error as Record<string, unknown>)["message"];
      if (typeof message === "string") return message;
    }
    if (typeof obj["message"] === "string") return obj["message"] as string;
  }
  if (text.length > 0 && text.length < 500) return text;
  return "Vercel API error";
};

/**
 * Single, DRY HTTP executor for every Vercel REST call. Handles
 * timeouts, retries (with `Retry-After` honoured), and error
 * mapping to domain errors. Never logs request bodies.
 */
export const executeVercelRequest = async <T = unknown>(
  path: string,
  options: VercelHttpOptions,
): Promise<VercelHttpResponse<T>> => {
  const method = options.method ?? "GET";
  const url = `${VERCEL_API_BASE}${path}`;
  const maxAttempts = (options.retries ?? DEFAULT_RETRIES) + 1;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/json",
      };
      const init: RequestInit = {
        method,
        headers,
        signal: controller.signal,
        // Refuse to follow redirects: legitimate Vercel REST endpoints
        // never redirect, and following them would let a hijacked DNS
        // entry or upstream MITM swap response bodies under us.
        redirect: "error",
      };
      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(options.body);
      }
      const response = await fetch(url, init);
      clearTimeout(timer);

      const { json, text } = await safeReadBody(response);

      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedError(extractApiMessage(json, text));
      }
      if (response.status >= 200 && response.status < 300) {
        return { status: response.status, body: json as T };
      }
      if (RETRYABLE_STATUSES.has(response.status) && attempt + 1 < maxAttempts) {
        await sleep(computeBackoff(attempt, response.headers.get("retry-after")));
        continue;
      }
      throw new IntegrationError(
        extractApiMessage(json, text),
        response.status,
      );
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err instanceof UnauthorizedError) throw err;
      if (err instanceof IntegrationError) {
        if (
          err.status !== undefined &&
          RETRYABLE_STATUSES.has(err.status) &&
          attempt + 1 < maxAttempts
        ) {
          await sleep(computeBackoff(attempt, null));
          continue;
        }
        throw err;
      }
      // Network / abort / unknown -> retry while we have attempts.
      if (attempt + 1 < maxAttempts) {
        await sleep(computeBackoff(attempt, null));
        continue;
      }
      throw new IntegrationError(
        err instanceof Error ? err.message : "Vercel request failed",
        undefined,
        err,
      );
    }
  }

  throw new IntegrationError(
    lastError instanceof Error ? lastError.message : "Vercel request failed",
    undefined,
    lastError,
  );
};
