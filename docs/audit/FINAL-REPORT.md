# ASCEND — final production readiness report

Date: 2026-11-11 · App version 0.12.0 · Final commit audited: `873bc8b` (`main`)
Scope: the whole application (web/PWA, Android, Supabase, Edge Functions, AI integration,
infrastructure). Programme: 10 phases, 19 commits, 62 files (+2,511 / −90 lines), two database
migrations, two Edge Function redeploys. Phase reports: `docs/audit/phase-1…9`.

## 1. Verdict

**Ready for its intended use: a personal, single-owner app** (one account, sideloaded Android
app, public web URL). Every Critical/High finding is fixed and verified in production; all
Medium findings are fixed, except two that need the owner's decision (V-05, V-07) and one new
one that needs the owner's signing key (F-1).

**Not yet ready for other users or a public launch** without the items in section 10
(multi-factor sign-in, a decision on end-to-end encryption, a release-signed app, a separate
development environment, and Play Store policy work).

Verification target: OWASP **ASVS 5.0 Level 1**, plus **Level 2** for authentication, sessions,
data protection and logging; **MASVS-L1** for Android. Result: L1 met; the selected L2 areas
met except where noted in section 6.

## 2. Architecture assessment

Local-first and sound. Every device holds the complete data in IndexedDB; every change goes
through one validated pipeline (`recordAction` → Zod schema → one transaction → domain events).
Supabase is an optional sync copy: one generic table, read through Row Level Security and
written only through definer functions keyed on the caller's verified identity. AI is a thin,
optional Edge Function. Strengths: a single write path, recomputable derived state, strong
tests. Debt addressed: a screen-time import cycle (5 cycles → 0), a 1.5 s planner query. Debt
remaining: 8 files slightly over the 300-line house rule; the start-up bundle is 1.4 MB (measured:
not worth splitting — Today needs nearly all of it).

## 3. Security assessment

| Area                  | Status          | Evidence                                                                                                                                                                   |
| --------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access control / IDOR | Strong          | RLS + definer-only writes; anon denied everywhere (live, daily); cross-user test in Postgres                                                                               |
| Least privilege (DB)  | Fixed           | Supabase/Postgres default grants revoked; fixed `search_path` on every function (test-enforced)                                                                            |
| Account creation      | Fixed (DB lock) | Allow-list trigger on `auth.users`; dashboard switch still **on** (owner)                                                                                                  |
| Resource abuse        | Fixed           | 8 MB request cap, 250,000-row ceiling per account, Ask 20/day/account                                                                                                      |
| Injection (SQL/XSS)   | No issues found | Parameterised SQL; React escaping; no `innerHTML`/`eval`; links re-validated on render                                                                                     |
| Browser hardening     | Fixed           | CSP (`script-src 'self'`, no eval) as header and `<meta>` (Android), nosniff, frame denial, Referrer-, Permissions-, Opener-Policy, HSTS preload; TLS 1.3, TLS 1.1 refused |
| Sessions              | Good            | PKCE; refresh rotation; account deletion needs a sign-in < 10 min old                                                                                                      |
| Secrets               | Clean           | No secret in code or 195 commits; server secrets only in Supabase; CI uses none                                                                                            |
| AI                    | Hardened        | Server-side allow-list, fenced prompt, output caps, timeouts; sensitive data never sent                                                                                    |
| Android               | Good, one gap   | No backup of app data, signed widget taps, immutable intents, CSP; **daily use of a debug build (F-1)**                                                                    |
| Supply chain          | Good            | Prod deps 0 vulnerabilities; actions pinned to SHAs; Dependabot; lockfile                                                                                                  |

## 4. Privacy assessment

Data minimisation is good: no analytics, ads or tracking (the CSP would block them). Only Ask
sends data out, only when asked, only allow-listed progress numbers plus the question (users are
told to leave out personal details; free models' providers may keep prompts — disclosed).
Health data, journal, mood, photos and screen time never leave the device and the user's own
account. Device storage is app-private and excluded from Android backups. Open: synced data is
readable by anyone with access to the Supabase project (V-07); weekly backup files sit in shared
storage (V-05); the error log is scrubbed of tokens and emails.

## 5. Vulnerability register (final)

| ID   | Sev.   | Finding                                                                                                                          | Status                                                        | Where verified                                           |
| ---- | ------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| V-01 | High   | Anyone could create an account                                                                                                   | **Fixed** (DB allow-list) · dashboard switch pending          | live: `live-api.spec`, SQL tests                         |
| V-02 | Medium | No per-account quota                                                                                                             | **Fixed**                                                     | SQL tests, live grants                                   |
| V-03 | Medium | No CSP / hardening headers                                                                                                       | **Fixed**                                                     | live headers, `security.spec` (0 violations, 15 screens) |
| V-04 | Medium | Android backup of health data + token                                                                                            | **Fixed**                                                     | built APK manifest                                       |
| V-05 | Medium | Plaintext weekly backups in shared storage                                                                                       | **Open — owner decision** (private storage or encryption)     | —                                                        |
| V-06 | Medium | No CI / deploy gate                                                                                                              | **Fixed** (CI) · branch protection pending (owner)            | CI green on `main`                                       |
| V-07 | Medium | Synced data readable server-side                                                                                                 | **Open — owner decision** (accept or E2E encryption)          | —                                                        |
| V-08 | Medium | No DR plan                                                                                                                       | **Fixed** (runbook; drills automated)                         | `RUNBOOK.md`                                             |
| V-09 | Low    | Forged widget taps                                                                                                               | **Fixed**                                                     | JUnit                                                    |
| V-10 | Low    | Over-broad DB grants                                                                                                             | **Fixed**                                                     | live: 8 RPCs denied                                      |
| V-11 | Low    | Account deletion with a stale session                                                                                            | **Fixed**                                                     | unit tests; live 401                                     |
| V-12 | Low    | Functions CORS `*`                                                                                                               | **Fixed**                                                     | live pre-flight                                          |
| V-13 | Info   | Link scheme (re-rated: was already validated)                                                                                    | **Hardened** (render guard)                                   | unit tests                                               |
| V-14 | Low    | Ask trusted client input / injection                                                                                             | **Fixed** (mitigated)                                         | `guard.test.ts`, live                                    |
| V-15 | Low    | Error log unscrubbed                                                                                                             | **Fixed**                                                     | unit tests                                               |
| V-16 | Low    | Dev-tool advisories                                                                                                              | **Accepted** (fixes are downgrades); Dependabot               | `npm audit`                                              |
| V-17 | Low    | Stale env docs / dead Gemini code                                                                                                | **Fixed** docs · Gemini kept (owner decision)                 | —                                                        |
| V-18 | Info   | Play-restricted permissions                                                                                                      | **Open** — only if publishing to Play                         | —                                                        |
| F-1  | Medium | **New:** the daily app is a debug build (debuggable: data and token readable over USB on an unlocked phone; WebView inspectable) | **Open — owner action** (create a signing key; release build) | `build.gradle`, README                                   |
| F-2  | Low    | **New:** a stolen session can wipe the cloud copy (`reset_my_cloud_data`) without a fresh sign-in; devices keep everything       | **Accepted** (recoverable from devices)                       | code review                                              |

## 6. Standards mapping

**ASVS 5.0 (L1 everywhere; L2 for V6, V7, V14, V16)**

| Chapter                           | Result         | Notes                                                                                                                                                  |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V1 Encoding & sanitisation        | Met            | React escaping, parameterised SQL, URL allow-listing                                                                                                   |
| V2 Validation & business logic    | Met            | Zod on every action, sync record and import; server re-validation (Ask, push limits)                                                                   |
| V3 Web frontend security          | Met            | CSP, frame denial, nosniff, HSTS, safe links                                                                                                           |
| V4 API & web service              | Met            | Auth on every function; CORS allow-list; size limits                                                                                                   |
| V5 File handling                  | Met            | Photos local-only, size-capped; backup/zip import validated                                                                                            |
| V6 Authentication (L2)            | **Partly**     | Passwordless (OAuth + magic link) via Supabase, PKCE, sign-ups locked; **no MFA** (L2) — section 10                                                    |
| V7 Session management (L2)        | Met with note  | Rotation, expiry, re-auth for deletion; tokens in localStorage (mitigated by CSP) rather than HttpOnly cookies — inherent to the SDK in an offline app |
| V8 Authorization                  | Met            | RLS + definer functions, least privilege, tested live daily                                                                                            |
| V9 Self-contained tokens          | Met            | Supabase-verified JWTs; claims read only after verification                                                                                            |
| V10 OAuth/OIDC                    | Met            | PKCE, provider-managed flow                                                                                                                            |
| V11 Cryptography                  | Met (platform) | TLS 1.3; secure random for widget secret; no custom crypto                                                                                             |
| V12 Secure communication          | Met            | HTTPS only, TLS ≥ 1.2, HSTS preload                                                                                                                    |
| V13 Configuration                 | Met            | Secrets server-side only; CI pinned; runbook                                                                                                           |
| V14 Data protection (L2)          | **Partly**     | Minimisation, no backups of app data, scrubbed logs; **V-05, V-07 open**                                                                               |
| V15 Secure coding & architecture  | Met            | Single write path, dependency hygiene                                                                                                                  |
| V16 Logging & error handling (L2) | **Partly**     | No secrets in logs; graceful errors; security events only in Supabase/GitHub logs (no central security log — acceptable for one user)                  |
| V17 WebRTC                        | N/A            |                                                                                                                                                        |

**MASVS-L1 (Android)**

| Group      | Result         | Notes                                                                                    |
| ---------- | -------------- | ---------------------------------------------------------------------------------------- |
| STORAGE    | Met with gap   | App-private storage, backup excluded; V-05 open                                          |
| CRYPTO     | Met (platform) |                                                                                          |
| AUTH       | Met            | Server-enforced; app link + PKCE                                                         |
| NETWORK    | Met            | HTTPS only, CSP `connect-src`                                                            |
| PLATFORM   | Met            | Exported components minimal; immutable intents; signed widget taps; deep links sanitised |
| CODE       | Met            | Dependencies current; WebView CSP                                                        |
| RESILIENCE | **Gap (F-1)**  | Debuggable debug build in daily use                                                      |
| PRIVACY    | Met            | Minimal permissions (Health Connect read: steps, sleep, exercise only); no tracking      |

## 7. Bugs discovered and fixed

| #   | Bug                                                                              | Found by            | Fix                                               |
| --- | -------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------- |
| 1   | 5 import cycles through the action pipeline                                      | knowledge graph     | server-time refresh moved out of `trustedTime.ts` |
| 2   | Every page broke the CSP (Zod's `new Function` probe)                            | new CSP e2e         | Zod jitless mode                                  |
| 3   | Internal DB helpers callable by everyone (Postgres grants `EXECUTE` to `PUBLIC`) | new SQL test        | revoked from `PUBLIC` too                         |
| 4   | Planner 1.5 s with ten years of data                                             | `npm run perf`      | day-indexed query → 35 ms                         |
| 5   | Unit tests assumed Indian-English dates                                          | CI                  | locale pinned for tests                           |
| 6   | Tests could end mid-action (teardown race)                                       | CI                  | global `actionsSettled()` wait                    |
| 7   | Locale setting broke e2e file uploads on Linux                                   | CI                  | scoped to unit tests                              |
| 8   | Invalid `bluetooth` Permissions-Policy feature (my Phase 3 header)               | CI (Linux Chromium) | removed; e2e fails on header warnings             |
| 9   | Security CSP e2e timed out against the live site                                 | production e2e      | 90 s budget for that walk                         |

Also corrected: my Phase 2 claim that skill links were unvalidated (they were — V-13 re-rated).

## 8. Tests executed and results (final state)

| Suite                                                                                                              | Result                                                         |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `npm run check` — type-check, ESLint, Prettier, 156 files / 896 unit + integration tests (incl. 41 Postgres tests) | ✓ (locally and in CI)                                          |
| Playwright e2e, phone + laptop (core flows, offline, axe accessibility, CSP on every screen)                       | 42 ✓, 14 skipped by design (opt-in screenshots and live tests) |
| Live API / security regression against production (`live-api.spec`, daily in CI)                                   | 6/6 ✓                                                          |
| 10-year performance (`npm run perf`)                                                                               | 13/13 within budget                                            |
| Simulation of game rules (`npm run simulate`)                                                                      | all checks ✓                                                   |
| Android JUnit + debug build + lint (locally and in CI)                                                             | 4/4 ✓, 0 lint errors                                           |
| Android emulator: real app under CSP, 15 screens                                                                   | 0 violations                                                   |
| Heap/listener stability (30 laps, forced GC)                                                                       | no leak                                                        |
| CI on `main` (`873bc8b`)                                                                                           | ✓                                                              |

Not executed: Deno unit test of the OpenRouter provider (no Deno installed — needs your OK);
code-coverage percentage (needs a new dev dependency — needs your OK); live tests with a real
signed-in account (needs you).

## 9. Performance and infrastructure

**Performance:** Today visible in ~1.4 s on a 4×-throttled phone profile (blocking ~290 ms); every
10-year operation within budget (planner 35 ms, Today data 87 ms, a quest tap 8 ms); no memory
growth over long sessions; sync batches by count and size with back-off.

**Infrastructure:** Vercel (HTTPS, HSTS preload, instant rollback) · Supabase Free (eu-west-1; no
automatic backups — devices and exports are the backups, schema rebuild tested) · GitHub Actions
CI on every push/PR and daily live checks with email alerts · Dependabot · runbook for release,
rollback, recovery and secret rotation.

## 10. Remaining risks and owner actions

**Do soon (owner):**

1. Supabase → Authentication: turn off **Allow new users to sign up**; delete unknown users.
2. GitHub → Settings → Branches: protect `main`, require CI.
3. **F-1:** create a release signing key (kept only by you), build a release APK for daily use,
   keep USB debugging off when not developing. I can write the steps.
4. Install the new APK (brings Phases 3–6 to the phone); sign in once; ask one real question;
   do the delete-account check (an hour after signing in it must ask you to sign in again).
5. Monthly export kept off the phone (no server backups on the Free plan).

**Decide (owner):** V-05 backup location · V-07 accept server-readable sync or add end-to-end
encryption · remove the unused Gemini code · a separate Supabase project for development.

## 11. Recommended future improvements

- Multi-factor sign-in (Supabase TOTP) before anyone else uses the app (ASVS L2 V6).
- End-to-end encryption of synced records (closes V-07) — a design change; needs your approval.
- Encrypted or app-private weekly backups (V-05).
- Release signing and, if ever published, a Play-compliant screen-time design (V-18).
- Supabase Pro (daily backups) if more people depend on the cloud copy.
- Deno in CI to run the Edge Function's own tests; coverage reporting.
- Keep the Kotlin/AGP toolchain current (clears the plugin metadata warning).

## 12. Evidence index

Phase reports `docs/audit/phase-1…9` (each with tests and deployment evidence) · decisions in
`DECISIONS.md` (2026-11-10/11 entries) · runbook `docs/operations/RUNBOOK.md` · CI runs on
GitHub (Actions) · live security checks `e2e/live-api.spec.ts` · migrations
`supabase/migrations/20261110000000_*`, `20261111000000_*`.
