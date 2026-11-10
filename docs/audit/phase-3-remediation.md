# Production hardening — Phase 3: critical and high vulnerability remediation

Date: 2026-11-10 · Builds on [phase-2-security-assessment.md](phase-2-security-assessment.md).
**Status: deployed 2026-11-10 with the owner's go-ahead** (was: fixed and verified locally, committed, not deployed) — pushing `main` deploys to
Vercel and the migration needs `supabase db push`; both wait for the owner's go-ahead.

## 1. Scope

Phase 2 found no Critical issues and one High (V-01). This phase fixed V-01 and the two
Medium issues that are cheap, self-contained and close the largest exposure: V-03 (no CSP) and
V-04 (Android backup of health data and the sign-in token). Items needing an owner decision
(V-05 backup location, V-07 server-side encryption) are untouched.

## 2. Changes

| ID               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Files                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| V-01 (High)      | **Database lock on sign-ups**: `before insert` trigger on `auth.users` refuses any new account whose email isn't in `private.signup_allowlist` (empty = closed). `private` schema and table are not reachable by `anon`/`authenticated`. Existing accounts are unaffected (sign-in never inserts a user).                                                                                                                                                                                                                                                  | `supabase/migrations/20261110000000_signup_allowlist.sql`, README "Sign-ups are closed" |
| V-03 (Medium)    | **CSP and hardening headers** on every response: `default-src 'self'`, `script-src 'self'` (no inline script, no eval), `connect-src 'self'` + the Supabase project, `img-src 'self' data: blob:`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`; plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`. `vite preview` serves the same headers (read from `vercel.json`) so e2e runs under the production policy. | `vercel.json`, `vite.config.ts`, `e2e/security.spec.ts`                                 |
| V-03 (bug found) | The new e2e test caught a real violation on every page: Zod 4 probes `new Function` (caught, but reported under CSP). Fixed with Zod's documented `jitless` mode, set before any schema is defined.                                                                                                                                                                                                                                                                                                                                                        | `src/zodConfig.ts`, `src/main.tsx`, `src/test/setup.ts`                                 |
| V-04 (Medium)    | **No Android backup or phone-to-phone copy of app data**: `allowBackup="false"`, `fullBackupContent="false"`, `dataExtractionRules` excluding all domains.                                                                                                                                                                                                                                                                                                                                                                                                 | `AndroidManifest.xml`, `res/xml/data_extraction_rules.xml`                              |

Accepted trade-offs: `style-src` keeps `'unsafe-inline'` (26 React style attributes and the
boot splash; style injection is far lower risk than script). A new phone no longer receives
ASCEND data through Android's transfer — sync or Export/Import does that (DECISIONS.md).

## 3. Tests and evidence

| Test                                                                                                                                                                                                                            | Result                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| New SQL tests (real migrations in PGlite): empty list refuses sign-up; allow-listed email accepted case-insensitively; email-less account refused; existing-account updates not blocked; app roles can't read or write the list | 5/5 passed (`sql.test.ts`, 36/36 in file)                                                                                     |
| New e2e `security.spec.ts`: headers on `/`, `/settings`, `/privacypolicy.html`; zero `securitypolicyviolation` events across 15 screens                                                                                         | 4/4 passed (phone + laptop). **Failed first** with 15 `script-src eval` violations → Zod fix → passed                         |
| Full e2e suite (onboarding, core loop, focus, goals, level-up, notifications, photos, account, career, Phase 8/11, offline, a11y, security) under the CSP                                                                       | 42 passed, 2 skipped (screenshot spec, opt-in)                                                                                |
| `npm run check` (tsc, ESLint, Prettier, Vitest)                                                                                                                                                                                 | Passed — 150 files, 857 tests                                                                                                 |
| Android `assembleDebug` + `lintDebug` (JDK 21)                                                                                                                                                                                  | Built; lint 0 errors; `aapt2 dump` of the APK shows `allowBackup=false`, `fullBackupContent=false`, `dataExtractionRules` set |

## 4. What the owner must do to complete V-01

1. Supabase Dashboard → Authentication → Sign In / Providers → turn off **Allow new users to
   sign up**.
2. Approve `npx supabase db push` (applies the allow-list trigger).
3. Check Authentication → Users for accounts you don't recognise; delete them if any.

Until steps 1–2, V-01 remains open in production.

## 5. Remaining risks

- V-01 open in production until deployed (above). V-02 (no per-account quota) remains for
  Phase 4 — with sign-ups closed, only your own account can write, which reduces it to Low.
- CSP only protects the web app; the Android WebView loads local files without HTTP headers
  (a `<meta>` CSP for Android is a Phase 6 candidate).
- V-05 (plaintext weekly backups in shared storage) and V-07 (server-readable sync data) wait
  for your decision.

## 6. Deployment (2026-11-10)

| Step                                    | Evidence                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `supabase db push --dry-run`            | Only `20261110000000_signup_allowlist.sql` pending                                                   |
| `supabase db push`                      | Applied; `supabase migration list --linked` shows it remote                                          |
| Allow-list not reachable via API        | `Accept-Profile: private` → `PGRST106 Invalid schema: private`                                       |
| `git push` (`3cdb9eb`) → Vercel         | Live response carries CSP, nosniff, X-Frame-Options, Referrer-Policy, COOP, Permissions-Policy, HSTS |
| e2e against production (`E2E_BASE_URL`) | `security.spec.ts` + `smoke.spec.ts`: 14/14 passed (phone + laptop, incl. offline)                   |
| Dashboard sign-up switch                | Still on (`disable_signup: false`) — owner action; the database lock already refuses new accounts    |
