/**
 * Headers applied to every response. The CSP locks the SPA down to
 * same-origin scripts, styles, and fetches; combined with the
 * server's Host/Origin allow-list, this provides strong defence
 * against DNS rebinding and cross-origin attacks.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; " +
    "script-src 'self'; " +
    "style-src 'self'; " +
    "img-src 'self' data:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "form-action 'self'; " +
    "base-uri 'none'; " +
    "frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "interest-cohort=(), camera=(), microphone=(), geolocation=(), payment=()",
};

export const applySecurityHeaders = (
  setHeader: (name: string, value: string) => void,
): void => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) setHeader(k, v);
};
