/**
 * Defence against DNS rebinding: only accept requests whose Host
 * header is one of the loopback hosts we expect to be reachable on
 * (and, for state-changing methods, whose Origin matches).
 *
 * The local-first threat model assumes the only legitimate caller
 * is a browser running on the same machine, hitting `localhost` /
 * `127.0.0.1` / `[::1]`.
 */

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

export interface OriginGuardOptions {
  readonly host: string;
  readonly port: number;
}

export interface OriginGuardResult {
  readonly ok: true;
}

export interface OriginGuardRejection {
  readonly ok: false;
  readonly status: number;
  readonly reason: string;
}

const allowedHosts = (port: number): ReadonlySet<string> =>
  new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    `[::1]:${port}`,
  ]);

const allowedOrigins = (port: number): readonly string[] => [
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  `http://[::1]:${port}`,
];

export const checkOrigin = (
  method: string,
  hostHeader: string | undefined,
  originHeader: string | undefined,
  options: OriginGuardOptions,
): OriginGuardResult | OriginGuardRejection => {
  // If the user explicitly bound to something other than loopback we
  // assume they accept the trade-off and skip the host allow-list,
  // but we still log a warning at startup (see main.ts).
  const isLoopbackBind =
    options.host === "127.0.0.1" ||
    options.host === "::1" ||
    options.host === "localhost";

  if (isLoopbackBind) {
    const hosts = allowedHosts(options.port);
    const host = (hostHeader ?? "").toLowerCase();
    if (!hosts.has(host)) {
      return {
        ok: false,
        status: 421, // Misdirected Request
        reason: "Host header not allowed",
      };
    }
  }

  if (!SAFE_METHODS.has(method)) {
    if (originHeader === undefined || originHeader === null) {
      // For mutating requests we require an Origin header. Browsers
      // send one for fetch/XHR; absence likely indicates a non-browser
      // client, which is acceptable only if Sec-Fetch-Site etc. are
      // present — but for simplicity we accept null Origin only for
      // safe methods.
      return {
        ok: false,
        status: 403,
        reason: "Origin header required for state-changing requests",
      };
    }
    const origins = allowedOrigins(options.port);
    const lower = originHeader.toLowerCase();
    if (!origins.includes(lower)) {
      return {
        ok: false,
        status: 403,
        reason: "Origin not allowed",
      };
    }
  }

  return { ok: true };
};
