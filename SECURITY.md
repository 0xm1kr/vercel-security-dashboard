# Security Policy

## Reporting a vulnerability

Please **do not** open public GitHub issues for security reports.

Instead, email a private maintainer (or use GitHub's "Report a vulnerability"
private advisory feature on this repository) with:

- A description of the issue and affected version / commit.
- Reproduction steps or proof of concept.
- Impact assessment (what an attacker could do).

We will acknowledge receipt within a reasonable timeframe and coordinate a
fix and disclosure window.

## Threat model summary

This project is a **local-first** developer tool. It assumes:

- The host machine is operated by a trusted user.
- The Vercel API token is **encrypted at rest** with a key derived from a
  user-supplied passphrase (`scrypt` + AES-256-GCM).
- The local SQLite database stores **inventory metadata only**: project ids,
  environment variable **names**, targets, vendor labels, and rotation
  status. **It does not store environment variable values.**
- The local HTTP interface binds to **`127.0.0.1`** by default and is not
  intended to be exposed to other hosts or the internet.

### What is and is not protected at rest

- **Protected at rest:** the Vercel API token, encrypted with AES-256-GCM and
  a key derived via `scrypt` (N=2¹⁷, r=8, p=1, 256 MiB maxmem — OWASP-2024
  baseline for interactive use). Stored at mode `0o600` and written
  atomically (temp file with `O_CREAT|O_EXCL`, `fsync`, then `rename(2)`) to
  prevent partial-write corruption and umask races. Refuses to overwrite an
  existing credential without an explicit `replaceExisting` flag.
- **Also `0o600`:** the connection profile (`profile.json`) and the
  vendor-rule suggestions file (`vendor-rules.suggested.json`).
- **Not protected at rest by default:** environment variable **names**,
  project metadata, scan history, rotation audit. Treat the SQLite file as
  sensitive.
- **In-memory secrets:** secrets are minimised, not eliminated.
  - The Vercel token is held in a `Buffer` and zeroed when the session is
    destroyed (lock, reset, or expiry).
  - New rotation values are held in a `Buffer` and zeroed in `finally`
    after each rotation, regardless of success or failure.
  - However, JSON parsing copies request bodies into V8 strings that we
    cannot explicitly free; outbound `fetch` builds request headers/bodies
    as JS strings; and `Buffer.toString("utf8")` allocates an immutable JS
    string each call.

  Assume an attacker with code execution or memory-read access to the Node
  process can observe the Vercel token and any rotation value while it is in
  flight.

## Local hardening in place

### Authentication

- **Passphrase strength** (server-enforced in the credential store, the
  save-onboarding use case, and the mint-token use case):
  - Minimum 12 characters.
  - At least 3 of {lowercase, uppercase, digit, symbol} **or** ≥ 16
    characters.
  - Small built-in common-weak list rejected.
  - Client-side mirrors the same rules for UX.
- **Brute-force resistance** on `/api/session/unlock`:
  - Per-IP failure throttle.
  - 3 free attempts, then exponential backoff: 2 s → 4 s → 8 s → … capped
    at 5 minutes.
  - Failure window of 5 minutes; success clears the bucket.

### Sessions

- 32-byte random session IDs (`crypto.randomBytes`).
- Bearer token held only in `Buffer`s; zeroed on session destroy.
- Cookies: `HttpOnly; SameSite=Strict; Path=/`.
- 1-hour sliding expiry with a 12-hour absolute cap (the slide can never
  extend past the absolute cap).

### HTTP transport

- Binds to `127.0.0.1` by default; non-loopback binds emit a startup warning.
- **Host allow-list:** every request must carry a `Host:` header matching
  one of `127.0.0.1:<port>`, `localhost:<port>`, or `[::1]:<port>` — blocks
  DNS-rebinding attacks against the local API.
- **Origin allow-list:** state-changing methods (POST/PUT/PATCH/DELETE)
  require an `Origin:` header that matches the same loopback host:port; a
  missing or mismatched origin returns 403.
- Strong response headers on every reply:
  - `Content-Security-Policy: default-src 'none'; script-src 'self';
    style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src
    'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
  - `Permissions-Policy: interest-cohort=(), camera=(), microphone=(),
    geolocation=(), payment=()`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `Cache-Control: no-store`
- Single error mapper produces JSON-only error bodies (no HTML, no leaked
  stack traces).

### Static asset serving

- Both the configured root and each candidate path are passed through
  `realpath`; the resolved candidate must be relative to the resolved root
  with no `..` segments — symlink-safe path traversal defence.
- URL decoding wrapped in `try/catch`; NUL bytes rejected.
- SPA fallback only ever serves the configured `indexFile`, never an
  arbitrary file.

### Outbound calls to Vercel (`api.vercel.com`)

- Single HTTP execution path with timeout, JSON-only request/response, and
  consistent error mapping.
- `redirect: "error"` — refuses to follow redirects, so a hijacked DNS
  entry or upstream MITM cannot swap response bodies.
- Bearer tokens and request bodies are never logged.

### Rotation flow

- New value is held in a `Buffer` and zeroed in `finally`, regardless of
  success or failure.
- The value is **never persisted locally** — only an audit row is appended
  (success/failure, status, optional note).
- Value size capped at 64 KiB to fail fast before hitting Vercel.
- Requested targets validated against the binding's known targets — no
  privilege expansion.
- Bindings already marked `superseded` are rejected.
- **Defaults to upgrading the env type to `sensitive`** so Vercel encrypts
  the value at rest and never returns it again. Per-rotation opt-out via
  the modal checkbox; `system`-typed bindings are never upgraded.
- Audit-write failures never swallow the original rotation error.

### Vendor-rule classification (user-extensible config)

- `rotateUrl` restricted to `http(s):` schemes — blocks `javascript:`,
  `data:`, `file:`, etc. from a hostile `vendor-rules.override.json`.
- Regex patterns capped at 256 characters and rejected by an
  obvious-ReDoS heuristic (e.g. `(a+)+`).
- All rule files validated through a unified parser; invalid rules cause a
  hard error rather than silently misclassifying.

### Data discipline

- Environment variable **values** are never written to SQLite, log files,
  or any other on-disk store. Only metadata (name, project, target,
  vendor, rotation status) and audit events are persisted.
- The `/api/onboarding/reset` endpoint wipes credentials and connection
  profile but preserves the audit history.

### Input validation

- Single JSON body reader with a hard size cap.
- Typed field helpers (`requireString`, `optionalString`, `optionalBoolean`,
  `optionalStringArray`, etc.) — every required field explicitly checked.
- All errors flow through one `mapErrorToHttp` translator for consistent
  responses.

### Dependency posture

- Single runtime dependency: `better-sqlite3`.
- Everything else (`fetch`, `http`, `crypto`, `scrypt`, `node:test`,
  `node:fs`, `node:path`) is a Node.js built-in.
- Each dependency has a written justification in
  [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md). New runtime dependencies
  require an entry in that file before merge.

## Out of scope

- Multi-user / multi-tenant deployments.
- Hostile users on the same machine with read access to `data/`.
- Side-channel attacks against the Node.js runtime or `better-sqlite3`.
- Memory disclosure once secrets have been copied into JS strings (see
  "In-memory secrets" above).
