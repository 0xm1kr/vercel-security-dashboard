# Runtime Dependencies

Every entry in `package.json` `dependencies` (runtime) must be justified
here. New runtime dependencies require a PR that updates this file.

`devDependencies` are not listed exhaustively, but are also kept minimal.

## Runtime

| Package | Version | Why we need it |
|---------|---------|----------------|
| [`better-sqlite3`](https://github.com/WiseGuyEh/better-sqlite3) | `11.3.0` | Synchronous SQLite driver. Used for the local inventory database. The Node built-in `node:sqlite` module is still flagged as experimental on the Node 20 LTS baseline, so we use this well-audited native binding. Re-evaluate when `node:sqlite` is stable on our Node baseline. |

## Explicitly avoided

- **`vercel` / `@vercel/*`** — All Vercel API access uses `fetch` against
  `https://api.vercel.com`. No npm package or CLI dependency.
- **HTTP client libraries** (`axios`, `got`, `node-fetch`, `undici` direct) —
  Node 20+ provides global `fetch`.
- **Web frameworks** (`express`, `fastify`, `koa`) — Node `http` is enough
  for our small local API surface.
- **Front-end frameworks** (`react`, `vue`, `svelte`) — UI is small enough
  to ship as static HTML/CSS/vanilla JS.
- **UI component libraries** including any Vercel-branded design system.
- **Crypto wrappers** — `node:crypto` provides AES-256-GCM and `scrypt`.
- **YAML parsers** — vendor rules ship as JSON to avoid a parser dep.

## Dev dependencies (informational)

| Package | Why |
|---------|-----|
| `typescript` | TypeScript compiler. |
| `@types/node` | Type definitions for Node built-ins. |
| `@types/better-sqlite3` | Type definitions for the SQLite driver. |
| `tsx` | Run TypeScript files directly under `node --test` for the test runner. |
