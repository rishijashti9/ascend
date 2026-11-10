# Production hardening — Phase 1: discovery and architecture audit

Date: 2026-11-10 · App version 0.12.0 (commit `2ae05ff`) · Read-only phase: no code changed.

## 1. What was inspected

- Product docs: SPEC.md (product, game rules, architecture rule 6.6, stack 9, data model 10,
  reliability 11), DECISIONS.md (all 299 lines, security-relevant entries in full), README.md
  (deploy, Android, Supabase, OpenRouter setup), PLAN/PROGRESS status.
- Whole-repo knowledge graph (`/graphify`): 3,464 nodes, 130 communities, import cycles.
- Server: all 7 Supabase migrations, both Edge Functions (`ask`, `delete-account`),
  `supabase/config.toml`, what is tracked under `supabase/`.
- Client: Supabase client and auth (`src/core/sync/client.ts`, `src/app/auth.ts`), sync engine,
  backend and apply action, Ask provider and context allow-list, cloud config, link handling.
- Android: `AndroidManifest.xml`, `capacitor.config.ts`, native Java plugins (via the graph).
- Deploy: `vercel.json`, live response headers of https://ascend-vert-mu.vercel.app.
- Tooling: `package.json`, `npm audit` (prod and all), `npm outdated`, tests and e2e layout.
- Secrets: `.env.example`, tracked files, a pattern scan of the full git history (176 commits).

## 2. Architecture as built

| Layer                        | What it is                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App                          | React 19 + TypeScript (strict) + Vite 8, Tailwind 4, React Router 8, Zustand. ~41k lines of source, 150 test files.                                                                                                                                                            |
| Local data (source of truth) | IndexedDB via Dexie, ~27 tables, versioned schema (v3). Fully usable offline, no account needed.                                                                                                                                                                               |
| Write path                   | Every change goes through `recordAction()` → Zod-validated `defineAction` → one Dexie transaction → domain events → subscribers (progress, achievements, widget, notifications, sync). Screens never write directly.                                                           |
| Sync (optional)              | Supabase eu-west-1. One generic table `sync_records` (user_id, tbl, id, data jsonb, HLC). Reads: RLS `user_id = auth.uid()`. Writes: only `push_records()` (SECURITY DEFINER, uses `auth.uid()`, LWW + domain merge rules, 500/batch, 256 KB/row). Photos never sync.          |
| Auth                         | Supabase magic link + Google OAuth, PKCE flow, session in localStorage (`ascend.auth`). Android returns via custom scheme `app.ascend.rishi://auth`.                                                                                                                           |
| AI                           | "Ask the System": client → Edge Function `ask` (JWT checked via `getUser`) → OpenRouter free models. Key is a Supabase secret. Local scope check, 10/day per device, 20/day per account (server), 7-day answer cache, allow-listed numeric context (no health, journal, mood). |
| Account deletion             | Edge Function `delete-account` (service role, user id from the caller's token) → cascade deletes cloud rows.                                                                                                                                                                   |
| Android                      | Capacitor 8 shell + small Java parts: widgets, screen-time service/receivers, usage reader, Health Connect (steps, sleep, exercise read-only).                                                                                                                                 |
| Hosting                      | Vercel, auto-deploy on push to `main`; SPA rewrite; PWA with service worker.                                                                                                                                                                                                   |
| Tests                        | Vitest 852 tests (unit, integration, Postgres rules via PGlite, sync two-device), Playwright 13 specs incl. axe a11y on phone + laptop, `npm run perf` 10-year dataset.                                                                                                        |

**Strengths found:** a single validated write path; RLS read-only table with definer-only
writes keyed on `auth.uid()`; anon role revoked everywhere it matters; PKCE; no secret ever in
client code or history (pattern scan clean; only the publishable key is committed, by design);
Ask context is an explicit allow-list with a test; no `innerHTML`/`eval` sinks; production
dependencies have 0 known vulnerabilities; strong test culture.

## 3. Preliminary findings (to be confirmed and fixed in Phases 2–9)

Severity is provisional until Phase 2 confirms exploitability.

### High

- **H1 Open sign-up on a personal app.** Local `config.toml` has `enable_signup = true`; the
  remote setting is not visible from the repo. If open remotely, anyone can create accounts,
  store unbounded data (no per-user row/byte quota in `push_records`) and spend the shared
  OpenRouter quota (20 questions/day **per account**, unlimited accounts). Needs your input.
- **H2 No Content-Security-Policy or other security headers.** Live site sends only HSTS.
  No CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` or frame
  protection. The Supabase session lives in localStorage, so any future XSS = token theft;
  CSP is the main defence-in-depth control (ASVS V14.4).

### Medium

- **M1 `android:allowBackup="true"`.** Android device/cloud backup includes the WebView's
  IndexedDB (health data, journal) and the Supabase refresh token.
- **M2 Synced personal data is plaintext JSON on Supabase** (body logs, reviews/journal,
  screen-time days). Matches the spec ("your own synced account") and Supabase encrypts at
  rest, but anyone with project/service-role access can read it. End-to-end encryption would
  be a major architectural change — your call.
- **M3 No CI.** Checks run only on the laptop; Vercel deploys whatever reaches `main` (its
  build runs `tsc`, not lint or tests). No branch protection, no dependency update automation.
- **M4 No server-side abuse limits on sync.** Row size is capped, row count and request rate
  are not (Supabase's platform limits only).
- **M5 Backups/DR rely on devices.** Free-tier Supabase has no point-in-time recovery; the
  recovery story is device data + JSON export + weekly Android file. Needs to be written down
  and tested (restore drill).

### Low

- **L1** `compact_my_records` is SECURITY DEFINER with `search_path = public` (should be `''`
  like the others); `sync_server_version`, `my_cloud_usage`, `server_time` set none.
- **L2** Skill project links aren't scheme-checked (job links are). React 19 blocks
  `javascript:` URLs at render, so this is defence in depth only.
- **L3** Edge Functions answer CORS `*`. Bearer tokens (not cookies) make this low impact.
- **L4** Ask: client-supplied `context`/`hints` reach the prompt unvalidated (length-capped
  only) — prompt injection is limited to the user's own answer; `ask_take` counts days in UTC.
- **L5** `.env.example` is stale (`VITE_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`).
- **L6** Dead code: `supabase/functions/ask/gemini.ts` and client `geminiProvider`.
- **L7** 20 dev-only advisories (18 moderate, 2 low: `deepmerge`, `uuid` in build tools).
- **L8** `QUERY_ALL_PACKAGES` and `PACKAGE_USAGE_STATS` are restricted by Google Play policy
  (fine for sideloading; a blocker only if published to Play).
- **L9** Tech debt: 8 non-data files just over the 300-line rule; the screen-time import
  cycle was fixed in `2ae05ff`.

### Not yet inspected (Phase 2 scope)

Local error log contents (PII?), backup import validation depth, Edge Function error paths,
service worker caching of authenticated responses, native plugin intent handling, notification
contents on the lock screen, remote Supabase dashboard settings (auth providers, redirect URL
allow-list, email rate limits, leaked-password and MFA options, database linter results).

## 4. Proposed verification target

OWASP **ASVS 5.0 Level 1** for the whole app, plus **Level 2** for authentication, session
management, data protection and logging (the app holds health and journal data), and the
OWASP **MASVS-L1** profile for the Android app. Level 3 is out of proportion for a single-user
personal app.

## 5. Tests run in this phase

| Check                                                                                    | Result                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `npm run check` (type-check, lint, Prettier, 852 Vitest tests)                           | Passed on `2ae05ff` (run for the cycle fix, same tree) |
| `npm audit --omit=dev`                                                                   | 0 vulnerabilities                                      |
| `npm audit` (incl. dev)                                                                  | 20: 18 moderate, 2 low, 0 high/critical                |
| Git history secret scan (service-role, OpenRouter, Anthropic, Google, JWT, private keys) | No secrets; matches were documentation placeholders    |
| Live headers `curl -I`                                                                   | HSTS only                                              |
| Playwright e2e                                                                           | Not run in this phase                                  |
