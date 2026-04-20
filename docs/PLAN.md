# Vercel Security Dashboard — Product & Technical Plan

This document describes goals, scope, **domain-driven architecture**, folder layout, data model, security properties, UI constraints, **dependency minimization**, and delivery criteria for a **local-first, open-source** tool that inventories Vercel environment variables (per organization), attributes them to likely third-party services, tracks rotation state and history, and performs **Vercel-only** rotation via **HTTP REST only**—with strict handling of secrets.

---

## 1. Vision

Give operators and developers a **single local UI** to:

1. **Scan** all projects under a chosen Vercel **organization/team** and record **metadata** about every environment variable binding.
2. **Classify** each variable with a **likely third-party service** (AWS, Neon, Stripe, …) using configurable rules, with sensible defaults for common providers.
3. **Review** a small dashboard: variable name, targets (production / preview / development), whether Vercel marks it as secret/encrypted, **rotation status**, and last scan/history.
4. **Rotate** by pasting a **new value** after updating the provider; the app updates **Vercel via HTTPS REST**, then records **rotated** state and timestamp—without persisting the new (or old) secret value.

The project is **open source** for anyone to run locally. Design for clarity, minimal network surface, **smallest practical dependency graph**, and contributor-friendly boundaries.

---

## 2. Non-goals (v1)

- Calling third-party provider APIs to rotate keys (architecture may reserve extension points; **v1 is Vercel-only**).
- Hosted multi-tenant SaaS or shared backend.
- Reading or displaying decrypted **current** secret values from Vercel (API constraints and security policy align: **metadata inventory**, not a secret vault).
- Guaranteed cryptographic wiping of secrets in memory (JavaScript limitations); the plan still mandates **best-effort** minimization of lifetime and scope.
- **Vercel CLI** or any **`vercel` / `@vercel/*` npm package** for runtime behavior (see §6.4).

---

## 3. Product principles

| Principle | Implication |
|-----------|-------------|
| **Local-only** | No required remote service beyond **Vercel HTTPS** for scan and rotate. |
| **Offline by default** | No telemetry, no third-party calls in v1 except Vercel during scan/rotate. |
| **Open source** | `LICENSE`, `SECURITY.md`, `.gitignore` for local DB/config, reproducible build docs, no secrets in repo. |
| **Simple but safe** | Prefer small attack surface: no stored plaintext secret **values**; encrypt API token at rest; clear documentation of what the SQLite file contains. |
| **Explicit multi-env** | Targets are first-class; rotation UX avoids accidental cross-target updates. |
| **Minimal dependencies** | Every runtime npm dependency must be **justified in `docs/DEPENDENCIES.md`** (or equivalent table in README); default is **Node built-ins first** (see §6.5). |
| **DRY implementation** | One mapping layer from Vercel JSON → domain models; one HTTP/retry path; shared primitives for pagination and errors (see §6.3). |
| **Complete shippables** | No merged code with **TODOs**, stubbed public APIs, or intentionally incomplete functions (see §11). |

---

## 4. User-facing scope

### 4.1 Organization scope

- User configures **one Vercel org/team** per **profile** (team id or slug as required by the API).
- Scanner enumerates **projects and env bindings under that org only**.
- **Default data layout:** one **SQLite database file per org profile** (clear isolation, backup, and “what’s in this file?” story). Document a future path: multiple profiles or merged views.

### 4.2 Historical tracking

- Each **scan** produces an immutable **snapshot** (timestamp, optional API version / cursor state).
- Persist **inventory metadata** sufficient to compute **diffs**: added / removed / **metadata changed** (e.g. type, targets, branch, remote env id).
- UI: timeline or filters (“show keys that disappeared since last scan”, “changed type”, etc.).
- **Never** store secret **values** from Vercel responses in SQLite, even if the API shape would allow it.

### 4.3 Rotation workflow (canonical order)

1. User opens **Rotate**; modal shows **third-party name** and **link** to provider docs/console (deep link only when stable and safe).
2. User **creates/rotates the secret in the third-party** first (out of band).
3. User pastes the **new value** into a **password** input.
4. On confirm, the app calls **Vercel REST** to update (or replace) the binding for the **selected target(s)**.
5. On success: set **rotated** flag (or status enum), **`rotated_at`** (UTC), append **audit row**. **Do not** write the new value to disk.
6. On failure: show API error; secret exists only in memory until the modal is closed or cleared.

### 4.4 Multi-environment (targets)

- Mirror Vercel’s model: **production**, **preview**, **development**, plus **branch** when applicable.
- **UI default:** one actionable row per **binding** (avoid ambiguous “one key” rows when targets differ). If the same key appears on multiple targets, support **per-target** rotation (checkboxes or separate rows) so production is not rotated by mistake.

### 4.5 First-run onboarding (REST token)

**What is possible without OAuth**

- Vercel exposes `POST /v3/user/tokens` to **mint** a new token, but that call itself requires an **existing** `Authorization: Bearer …` session. A totally unauthenticated local app **cannot** create the user’s first token over the wire without either **(a)** the user **creating the token in the Vercel dashboard** (or pasting an existing token once), or **(b)** implementing a **Vercel OAuth / integration** flow (registered app, redirect, tokens)—which adds dependencies, secrets for `client_secret` (or a documented bring-your-own OAuth app pattern), and is **out of scope for v1** unless explicitly prioritized later.
- Therefore v1 onboarding is a **guided flow** that makes token creation **foolproof** and **validates** credentials before persisting them—**not** a silent “generate token with zero user steps” unless we add OAuth later.

**v1 onboarding flow (required)**

First launch (or “Settings → Reconnect”) walks the user through:

1. **Explain** least privilege: prefer a **team-scoped** token for the target org only; link to Vercel’s official docs on [creating tokens](https://vercel.com/docs/rest-api/authentication/create-an-auth-token.md) and team scoping / [team-scoped access tokens](https://vercel.com/changelog/access-tokens-can-now-be-scoped-to-teams) (URLs maintained in UI copy or config so they can be updated without code churn).
2. **Open Vercel** (user’s browser): primary button opens the **account / token creation** page on `vercel.com` (use the current official URL—verify at ship time so it does not rot).
3. **Paste token** into a **password** field; never echo full token in logs or persist plaintext.
4. **Verify connection:** server-side `GET` a minimal endpoint (e.g. current user or team list per REST docs) with `Authorization: Bearer <pasted>`; show clear success or **sanitized** failure (401/403 → wrong token or insufficient role).
5. **Choose team:** if the token is **not** pre-scoped to one team, call **list teams** (or equivalent documented endpoint) and let the user **pick the org**; persist **`teamId`** (and display name) for all subsequent scan/rotate calls.
6. **Save:** encrypt and store via `CredentialStore`; clear paste field and any in-memory copies per §10.2 patterns; redirect to dashboard or offer **Run first scan**.

**Optional v1 enhancement (still REST-only, no Vercel npm packages)**

- After step 4 succeeds, offer **“Mint a dedicated dashboard token”**: call `POST /v3/user/tokens` with the **just-verified** bearer to create a **new** named token (e.g. “security-dashboard”), optionally with `teamId` in the query string per API docs, then **replace** stored credentials with the **new** `bearerToken` from the response and show **“revoke the bootstrap token in Vercel if it was too broad.”** This reduces long-lived use of a hand-pasted token when the user started with a wide token—**only if** the API allows the desired scope from the current session.

**Application layer**

- Dedicated use cases: e.g. `VerifyVercelCredentials`, `SaveOnboardingProfile` (token + `teamId`), optional `MintScopedTokenAndRotateStoredSecret`—each fully implemented, no stubs (§11).

**UI**

- Wizard can be **multi-step** (`<dialog>` or sequential screens): welcome → create token (link) → paste → verify → team pick → save → done.
- If credentials already valid, **skip** wizard and land on dashboard (detect via local flag or “probe” endpoint).

---

## 5. Third-party attribution

### 5.1 Behavior

- Each inventory row gets **zero or more** “likely vendor” labels with **confidence** (exact match > prefix > generic).
- Show **vendor display name** and **documentation / rotation help URL** in the dashboard and rotate modal.

### 5.2 Rule sources (config + defaults)

- **Default rules file** in the repo: prefer **`config/vendor-rules.default.json`** to avoid a YAML parser dependency unless YAML is explicitly added later with justification.
- **Ship ~20 common vendors** in v1 (candidates include AWS, GCP, Azure, Stripe, Neon, Supabase, PlanetScale, MongoDB Atlas, Clerk, Auth0, Sentry, Datadog, OpenAI, Anthropic, Twilio, SendGrid, GitHub, Firebase, Upstash, Redis/Valkey cloud—or equivalent “top 20” curated set).
- **User override file** (e.g. `~/.config/<app>/vendor-rules.override.json`) merged with defaults; document **precedence** (override wins on conflict).

### 5.3 “Prefill from what we find”

- After scans, emit a **local suggestions artifact** (e.g. `vendor-rules.suggested.json` under app data dir, **gitignored**): unmatched keys with **frequency**, optional heuristic hints.
- **Do not** auto-commit suggestions to the public repo from the app; users may copy rules into override manually.

---

## 6. Software architecture (DDD)

### 6.1 Strategic design: bounded contexts

Use a **modular monolith** with **explicit bounded contexts**. Each context owns its aggregates and **does not reach across** context boundaries except through **application services** or **domain events** (in-process only for v1).

| Context | Responsibility | Core aggregates / concepts |
|---------|----------------|----------------------------|
| **Inventory** | Scans, projects, env bindings, snapshots, diffs | `Scan`, `Project`, `EnvBinding`, `DiffEvent` |
| **Rotation** | Rotate use case, rotation audit, status transitions | `RotationEvent`, policies on `EnvBinding` |
| **Classification** | Vendor rules load/merge, classify env key | `Vendor`, `VendorRuleSet`, `ClassificationResult` |
| **Credentials** | Store/load **encrypted** API token; never domain aggregates | `EncryptedCredential`, key derivation / OS store adapter |

**Shared kernel** (minimal): shared value objects (`TeamId`, `ProjectId`, `EnvKey`, `Target[]`), shared errors (`AppError`, `VercelApiError`), and **cross-cutting** utilities used by more than one context (pagination cursor type, clock port).

Contexts **must not** import infrastructure from another context’s folder; orchestration lives in **application** use cases that compose ports.

### 6.2 Tactical design: layers and dependency rule

```
┌─────────────────────────────────────────────────────────────┐
│  Interface adapters (HTTP API for UI, static asset server)   │
└─────────────────────────────┬───────────────────────────────┘
                              │ calls
┌─────────────────────────────▼───────────────────────────────┐
│  Application layer — use cases (application services)        │
│  Orchestrates domain + ports; no Vercel/JSON/SQL in use cases  │
└─────────────────────────────┬───────────────────────────────┘
                              │ depends on
┌─────────────────────────────▼───────────────────────────────┐
│  Domain layer — entities, value objects, domain services,      │
│  domain errors; port *interfaces* (repos, clock, ids)          │
└─────────────────────────────────────────────────────────────┘
         ▲ implements
┌────────┴──────────────────────────────────────────────────────┐
│  Infrastructure — Vercel REST client, SQLite repos, file       │
│  rules loader, crypto/keychain                                 │
└────────────────────────────────────────────────────────────────┘
```

- **Domain** has **zero** imports from `infrastructure/` or UI.
- **Application** depends on **domain** and **ports** (interfaces); it contains **use case** classes/functions (`RunScan`, `RotateEnvBinding`, `LoadDashboardData`) that accept ports as constructor or function arguments (**hexagonal / ports & adapters**).
- **Infrastructure** implements ports: `VercelTeamProjectGateway`, `VercelEnvGateway`, `InventoryRepository`, `RotationRepository`, `CredentialStore`, `VendorRuleSource`.
- **Interface adapters** map HTTP DTOs ↔ application DTOs; **no business rules** in route handlers beyond validation.

### 6.3 DRY rules (project standards)

- **Single Vercel response adapter:** one module (or class) per API resource family that maps **raw JSON → domain types**. UI and SQLite layers never parse Vercel field names directly.
- **Single HTTP execution path:** one low-level `request(method, path, options)` with shared **timeout**, **retry with backoff**, **`Retry-After`**, and **error body → `VercelApiError`** mapping. No duplicated `fetch` wrappers.
- **Single pagination helper** used by projects and env list endpoints (cursor/until semantics per Vercel docs).
- **Single classification pipeline:** rules merged once; classification is pure function `classify(key: EnvKey): ClassificationResult[]`.
- **No copy-paste** SQL strings split across files for the same table—use a **repository** per aggregate or query object pattern.

### 6.4 Vercel integration: REST only, no Vercel packages

- **Only** `https://api.vercel.com` (or current documented base URL) via **`fetch`** (Node **LTS** global `fetch`) or the same **single** thin wrapper around `fetch`.
- **Forbidden in `dependencies`:** `vercel`, `@vercel/node`, `@vercel/static-build`, `@vercel/analytics`, `@vercel/speed-insights`, or **any** `@vercel/*` scope package unless an exceptional non-runtime case is approved (default: **none**).
- **Forbidden:** relying on **Vercel CLI** for scan or rotate in automated or documented primary flows.
- Version the paths used (e.g. `/v9/...`, `/v10/...`) in **one** `vercel-api-routes.ts` (or similar) file aligned with official docs; bumping the API is a deliberate change in one place.

### 6.5 Minimal npm packages (security posture)

- **Prefer zero runtime dependencies** where practical: use **Node built-ins** (`node:crypto`, `node:fs/promises`, `node:path`, `node:url`, global `fetch`).
- **SQLite:** use the **smallest** viable option consistent with the chosen Node version (e.g. if a built-in SQLite module is available and stable for the project’s Node baseline, prefer it; otherwise **one** well-audited driver—document the tradeoff in `docs/DEPENDENCIES.md`).
- **Rules format:** default **JSON** rules on disk to avoid extra parsers.
- **UI:** avoid UI component libraries unless necessary; **never** add Vercel-branded UI packages (see §9).
- **TypeScript / build / test tooling** live in `devDependencies` only.
- **Process:** new **runtime** dependency requires a **one-line justification** + link to upstream repo in `docs/DEPENDENCIES.md` before merge.

### 6.6 Repository folder structure (recommended)

Single application package (adjust names if monorepo later):

```
src/
  domain/
    inventory/           # EnvBinding, Project, Scan, DiffEvent entities + invariants
    rotation/              # Rotation policy, RotationEvent entity
    classification/        # Vendor, VendorRule, ClassificationResult
    credentials/           # Credential domain types (no secrets in entities)
    shared/                # Value objects, Result/Either, domain errors
  application/
    ports/                 # Interfaces only (e.g. InventoryRepository, VercelEnvPort)
    inventory/             # RunScanUseCase, GetBindingHistoryUseCase
    rotation/              # RotateBindingUseCase
    classification/        # MergeRulesUseCase, ClassifyKeyUseCase
    dashboard/             # Read models / queries if needed (thin)
  infrastructure/
    vercel/                # VercelRestClient, mappers JSON→domain, route constants
    persistence/           # SQLite schema, migrations, repository implementations
    classification/      # FileVendorRuleSource (default + override + suggestions writer)
    credentials/           # Encrypted file or keychain adapter implementing port
  interface/
    http/                  # Local server routes: map body/query → use cases
    static/                # Served built UI assets (if applicable)
  ui/                      # Thin presentation: HTML/CSS/TS; calls only HTTP API
config/
  vendor-rules.default.json
docs/
  PLAN.md
  DEPENDENCIES.md
```

**Tests** mirror production boundaries:

```
tests/
  domain/
  application/
  infrastructure/          # contract tests with fixtures
  interface/
```

---

## 7. High-level runtime diagram

```
┌─────────────────┐     HTTPS REST    ┌──────────────┐
│  UI (simple)    │ ────────────────► │ Vercel API   │
│  localhost      │   scan / rotate   │ api.vercel.com│
└────────┬────────┘                   └──────────────┘
         │ HTTP (local)
         ▼
┌─────────────────┐
│  Interface HTTP │  validates input, no secrets logged
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Application    │  use cases
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Domain         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Infrastructure │  SQLite, REST client, crypto
└─────────────────┘
```

---

## 8. Data model (SQLite)

### 8.1 Entities (conceptual)

- **`profiles` / `settings`:** active org id, last full scan time, app version, **no plaintext API token**.
- **`projects`:** cached project id, name, slug, linkage metadata from API.
- **`env_bindings`:** composite identity aligned to Vercel env object: remote env id, project id, **key name (plaintext)**, targets (JSON array), branch, type (plain/secret/system/etc. as returned), timestamps from API, `last_seen_scan_id`, **rotation_status**, **`rotated_at`** (nullable).
- **`scans`:** scan id, started/completed, status, optional cursor watermark.
- **`scan_snapshots`:** optional normalized JSON blob or normalized tables for diff engine (prefer normalized rows if diff queries are common).
- **`diff_events`:** scan id, binding id, change kind (`added` | `removed` | `updated`), field-level change summary without values.
- **`rotation_events`:** binding id, timestamp, success/failure, HTTP status, **sanitized** error message, optional user note—**no secret values**.
- **`vendors`:** id, display name, help URL (static or loaded from default rules).

Indexes: `(project_id, key_name)`, `(rotation_status)`, `(last_seen_scan_id)`.

### 8.2 Rotation state

- **`rotation_status`:** e.g. `never` | `rotated` | `superseded` (if remote id changed or binding removed).
- **`rotated_at`:** set only on successful Vercel update initiated from the app (or optional “mark rotated externally” if you add that later—document semantics).

---

## 9. UI guidelines

- **Simple but decent:** clear typography, spacing, contrast, responsive table; **CSS custom properties** for a small theme (background, surface, border, accent, danger); **system font stack**—no requirement for webfont npm packages.
- **Semantic HTML** (`main`, `table`/`thead`/`tbody`, `dialog` for modal, `label` + `input type="password"`).
- **Forbidden:** any **Vercel-specific UI package** (e.g. Geist-only distributions, `@vercel/analytics` for UI, Vercel-branded component kits). The product is independent of Vercel’s design system.
- **Interaction:** UI talks to the **local interface HTTP layer** only; it does **not** import `infrastructure/` or call Vercel directly from the browser bundle (keeps tokens and DDD boundaries server-side if using a local server).

---

## 10. Security & privacy

### 10.1 At rest

- **Do not persist** environment **values** (old or new) in SQLite.
- **Env variable names** and structural metadata may be **plaintext** in DB (per product decision) — still sensitive; warn in README.
- **Vercel API token:** **encrypted at rest** (preferred: OS keychain via a small adapter; alternative: envelope encryption with a **user passphrase** and document recovery).
- Optional: **SQLCipher** or full-disk encryption guidance for the SQLite file.

### 10.2 In memory (rotation path)

- Hold the new secret in a **`Buffer`** (or minimal-scope binary type) only for the HTTP request lifecycle.
- After completion: **`buffer.fill(0)`**, drop references; clear password input in UI state.
- **Never** log request bodies, tokens, or request payloads containing secrets; redact errors from upstream when echoing user data.

### 10.3 Open-source hygiene

- `.gitignore`: local DB, override configs, suggested rules, any `.env` or token files.
- `SECURITY.md`: how to report issues.
- CI: lint, typecheck, optional minimal integration tests with **mocked** Vercel REST responses.

---

## 11. Engineering quality bar (completeness)

**Merged code must be shippable:** no `TODO`, `FIXME`, `XXX`, placeholder `notImplemented()`, empty function bodies for exported APIs, or “throw later” stubs in **application**, **domain**, **infrastructure**, or **public** **interface** layers.

- If a feature is out of scope, **omit** the export surface until implemented; do not leave a callable stub.
- **Exception handling:** every external I/O path (REST, SQLite, filesystem) has **defined** error mapping to user-safe messages and logging policy.
- **Documentation** for public use cases: short JSDoc or TSDoc on **ports** and **use case entrypoints** describing preconditions and side effects.

This is a **merge gate** for contributors, not aspirational text.

---

## 12. Dashboard (functional requirements)

- **Table:** org, project, key name, targets, type (secret/plain from API), likely vendor(s) with link, **rotation status**, `rotated_at`, last changed from history.
- **Filters:** by project, vendor, rotated/unrotated, “changed since last scan”.
- **Actions:** **Scan now**, **Rotate** (opens modal), optional **export** of metadata (CSV) without values.

### 12.1 Rotate modal

1. Vendor display name + **external link**.
2. Short copy: **update secret in provider first**, then paste here.
3. **Password** input for new value; optional “show briefly” behind a warning.
4. **Target selection** when multiple bindings share a name (multi-env).
5. **Save:** REST call → success updates SQLite rotation fields + audit.

---

## 13. Scanner behavior

1. Authenticate with stored token (decrypt in memory only for the operation).
2. List projects for configured org with pagination until complete.
3. For each project, list env vars with pagination.
4. Upsert `env_bindings`; attach `scan_id`; compute `diff_events` vs previous snapshot.
5. Run **vendor classifier** (default + override rules); store `vendor_id` / labels on binding or join table.
6. Write **suggestions file** for keys with no rule match (frequencies, sample projects—no values).

---

## 14. Testing & quality

- **Unit tests:** domain invariants, classifier, diff engine, merge of vendor rules, crypto helpers (vectors).
- **Contract tests:** Vercel REST client against **recorded JSON fixtures** (no real token in repo); assert mapper completeness for fields the domain needs.
- **Manual checklist:** first-time setup, scan large org, rotate one binding on one target, verify DB has no value columns populated.

---

## 15. Deliverables (v1)

| # | Deliverable |
|---|-------------|
| 1 | Repository layout per §6.6 + `docs/DEPENDENCIES.md` listing every runtime dep with justification. |
| 2 | DDD layers respected; use cases wired; **REST-only** Vercel client per §6.4. |
| 3 | Org-scoped scanner + manual/scheduled scan + shared pagination/retry path. |
| 4 | SQLite schema: inventory, scans, diffs, rotation + audit; repository implementations **complete**. |
| 5 | Default vendor rules (~20) in JSON + override merge + post-scan suggestions file. |
| 6 | Simple, decent UI per §9; **no** Vercel UI packages; UI uses local HTTP API only. |
| 7 | Rotate modal + Vercel REST update + `rotated_at` / status + audit; Buffer lifecycle per §10.2. |
| 8 | Encrypted token storage + documented threat model. |
| 9 | OSS files: `LICENSE`, `SECURITY.md`, `.gitignore`; quality bar per §11. |
| 10 | **First-run onboarding** (§4.5): guided token setup, verify, team selection, encrypted save; optional mint narrower token via `POST /v3/user/tokens`. |

---

## 16. Future extensions (out of scope for v1)

- Provider API plugins (`RotationBackend` implementations behind the same rotation use case).
- Multiple orgs in one UI with strict separation.
- Encrypted env **names** (if customers demand it—complicates search and rules).
- YAML vendor rules **if** a parser dependency is accepted with documentation.
- **OAuth / “Sign in with Vercel”** (or marketplace integration) so users never paste a token; requires app registration, redirect URI handling, and a documented OSS pattern (e.g. bring-your-own `client_id`/`client_secret`).

---

## 17. Implementation stack (locked constraints)

| Area | Constraint |
|------|------------|
| Vercel | **HTTPS REST only**; **no** Vercel npm packages; **no** CLI in primary path |
| Dependencies | **Minimal runtime** npm; built-ins first; justify each dep |
| UI | Simple, decent, **no Vercel-related UI packages** |
| Architecture | **DDD** bounded contexts + **hexagonal** ports; **DRY** shared HTTP + mappers |
| Completeness | **No TODOs** / incomplete public APIs in merged code (§11) |

---

## 18. Roadmap (living checklist)

Use this section as the **single execution checklist** while building. Check items off (`[x]`) when they are **done in `main`** (or your default branch), not when planned. Add sub-bullets if you split work; keep the top-level boxes meaningful.

**Convention:** each phase should end in a **small demo**: run locally, perform one user-visible action, confirm no secret values on disk.

### Phase 0 — Repository & guardrails

- [x] `LICENSE` chosen and committed
- [x] `SECURITY.md` with vulnerability reporting steps
- [x] `.gitignore` covers local DB, token/credential files, `vendor-rules.suggested.json`, override paths, build output
- [x] `docs/DEPENDENCIES.md` created; every **runtime** dependency listed with one-line justification (update whenever `package.json` changes)
- [x] `README.md`: clone, Node version, install, run, where the SQLite file lives, threat-model summary (no secrets in repo)
- [x] TypeScript strict (or documented equivalent) + lint + format policy documented
- [ ] CI runs lint + typecheck + tests on PR

### Phase 1 — DDD skeleton & domain core

- [x] Folder layout matches §6.6 (`domain/`, `application/ports/`, `application/*/use-cases`, `infrastructure/`, `interface/`, `ui/`)
- [x] Shared kernel: domain errors, IDs/value objects used across contexts (`TeamId`, `ProjectId`, `EnvKey`, targets)
- [x] **Inventory** context: entities `Project`, `EnvBinding`, `Scan`, `DiffEvent`; invariants documented in code
- [x] **Rotation** context: `RotationEvent`, binding rotation status rules
- [x] **Classification** context: `Vendor`, `VendorRule`, `ClassificationResult` (pure classification from key name)
- [x] **Credentials** context: types for “token never in domain aggregates” boundary documented

### Phase 2 — Ports (application interfaces)

- [x] `VercelTeamProjectPort` (or equivalent): list projects for org with pagination cursor (consolidated as single `VercelPort` for DRY)
- [x] `VercelEnvPort`: list envs per project; patch/create/replace env value for rotation (per REST docs)
- [x] `InventoryRepository`, `ScanRepository` / snapshot persistence ports
- [x] `RotationRepository` / audit append port
- [x] `CredentialStore` port: save/load **encrypted** token; no plaintext persistence
- [x] `VendorRuleSource` port: load default + override JSON from disk paths
- [x] `Clock` / `IdGenerator` ports if used (easier testing)

### Phase 3 — Infrastructure: Vercel REST (no packages)

- [x] Single `fetch`-based HTTP executor: timeouts, retries, `Retry-After`, unified `VercelApiError` mapping (§6.3 DRY)
- [x] Route/version constants in one module; pinned paths documented in `DEPENDENCIES` or README “API version”
- [x] **One** JSON → domain mapper per resource (projects, envs); fixtures checked in under `tests/` or `fixtures/vercel/`
- [x] Contract tests: mapper + client behavior against **recorded** JSON (no real token)

### Phase 4 — Infrastructure: SQLite & migrations

- [x] Schema for profiles/settings, projects, env_bindings, scans, diff_events, rotation_events (and vendors/joins as designed)
- [x] Migrations or bootstrap DDL versioned in repo
- [x] Repository implementations satisfy ports; indexes from §8.1
- [x] Verified: **no table column** stores env **values** or raw API token

### Phase 5 — Infrastructure: credentials & crypto

- [x] `CredentialStore` implementation: encrypt at rest (keychain **or** passphrase envelope—pick one for v1 and document) — passphrase envelope (`scrypt` + `AES-256-GCM`)
- [x] Key derivation / file layout documented in README
- [ ] Manual test: restart app, token still works, still not plaintext in SQLite

### Phase 5b — First-run onboarding (REST token)

- [x] Wizard UI per §4.5 (welcome → official doc links → paste token → verify → team pick → save)
- [x] Local API: **verify** endpoint (minimal Vercel REST call; returns success / safe error; **no** token logging)
- [x] Local API: **save onboarding** (encrypt token + persist `teamId` / display name); reject save until verify succeeds
- [x] **List teams** (or equivalent) when token is not single-team scoped, so user picks org without hand-copying `teamId` from dashboard
- [x] Skip wizard when valid credentials + `teamId` already configured
- [x] Optional: **mint scoped token** via `POST /v3/user/tokens` after verify, swap stored secret, user messaging to revoke bootstrap token
- [x] README onboarding section matches the wizard (screenshots optional)

### Phase 6 — Application use cases (wire everything)

- [x] `RunScanUseCase`: org-scoped full scan, upsert bindings, write scan + diff events, invoke classifier, write suggestions file for unmatched keys
- [x] `GetDashboardDataUseCase` (or query service): list/filter bindings with vendor + rotation fields
- [x] `RotateEnvBindingUseCase`: Buffer-based secret handling, REST update, SQLite rotation + audit on success; no value persistence
- [ ] Optional: scheduled scan uses same use case path as manual (no duplicated logic)

### Phase 7 — Classification assets

- [x] `config/vendor-rules.default.json` with ~20 vendors + patterns + URLs
- [x] Merge default + user override with documented precedence
- [x] Post-scan `vendor-rules.suggested.json` (gitignored path) generation working

### Phase 8 — Interface HTTP (local API)

- [x] Local HTTP server starts/stops documented
- [x] Routes: health, config (org id **without** leaking token), **onboarding verify + save** (§4.5, §5b), trigger scan, list bindings (filters), rotate endpoint **or** RPC shape as designed
- [x] Request validation; errors mapped to safe JSON messages; **no** body logging for rotate
- [x] CORS / bind address: default **localhost only** documented

### Phase 9 — UI (simple, decent, no Vercel UI packages)

- [x] Static or built assets served from `interface/`; **no** imports from `infrastructure/` in browser bundle
- [x] Dashboard table: project, key, targets, secret/plain, vendor + link, rotation status, `rotated_at`
- [x] Filters: project, vendor, rotated, “changed since last scan” (as feasible)
- [x] “Scan now” triggers local API; loading/error states
- [x] Rotate `dialog`: vendor link, password input, target selection when needed, submit → success/failure feedback
- [x] CSS theme via custom properties; keyboard focus visible; basic responsive layout

### Phase 10 — Testing & hardening

- [x] Domain unit tests (invariants, classification, diff logic)
- [x] Application tests with in-memory fakes for ports
- [ ] End-to-end or integration test: mock Vercel HTTP server → full scan path (optional but ideal)
- [ ] Manual checklist §14 completed once on a real org (non-prod recommended for first rotate test)

### Phase 11 — Release readiness

- [x] `SECURITY.md` and README threat model match actual behavior
- [ ] Version tag / changelog policy (even if “CHANGELOG.md” one-liners)
- [ ] Final pass: **grep** for `TODO|FIXME|notImplemented|throw new Error\('not` in `src/` — must be clean per §11
- [ ] Tag **v1.0.0** (or chosen first version) when Phase 0–11 boxes relevant to v1 are complete

### Parking lot (post-v1 — do not block v1)

Track ideas here so they do not sprawl into v1 scope.

- [ ] Second org profile / multi-profile UI
- [ ] Provider API rotation backends
- [ ] YAML rules + parser dependency (if ever justified)
- [ ] SQLCipher / encrypted SQLite file
- [ ] OAuth / “Sign in with Vercel” (or integration) for token acquisition without pasting a PAT (see §16)

---

## Document history

- **v1:** Initial consolidated plan from product Q&A and security constraints.
- **v2:** DDD folder structure, DRY rules, completeness bar, UI and dependency constraints, REST-only / no Vercel packages.
- **v3:** Roadmap with phased living checklist and parking lot.
- **v4:** First-run onboarding (§4.5): guided REST token setup, verify + team pick, optional mint via `POST /v3/user/tokens`; roadmap Phase 5b + deliverable row; OAuth deferred to §16 / parking lot.
