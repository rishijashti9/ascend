# Production hardening — Phase 4: authentication, authorization and database hardening

Date: 2026-11-11 · Builds on [phase-3-remediation.md](phase-3-remediation.md).
**Status: deployed 2026-11-11 with the owner's go-ahead** (was: committed, not deployed). Deploying needs
`supabase db push` (migration), `supabase functions deploy delete-account` and a push to
`main` (app) — waiting for the owner's go-ahead.

## 1. What was inspected

Every database function's privileges and `search_path` (against Supabase's real default
grants), the sync write path's resource limits, the account-deletion flow end to end (app →
Edge Function → auth admin), and the Android widget's broadcast receiver.

## 2. Problems found and fixed

| ID   | Sev.         | Problem                                                                                                                                                                                                                                                                                                                                                                            | Fix                                                                                                                                                                                                                                   | Files                                                                                     |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| V-10 | Low          | Supabase grants new functions/tables to `anon`/`authenticated` directly, and Postgres grants `EXECUTE` to `PUBLIC`, so earlier `revoke … from public` left gaps: anon could call `compact_my_records`, `sync_server_version`, `my_cloud_usage`; anyone could call the internal merge helpers; the API roles kept grants on the Ask tables. 5 functions had no fixed `search_path`. | Revoke from `public`, `anon`, `authenticated` as appropriate; `anon` keeps only `server_time()`; every function `search_path = ''`.                                                                                                   | `supabase/migrations/20261111000000_db_hardening.sql`                                     |
| V-02 | Medium → Low | No ceiling on rows per account or request size.                                                                                                                                                                                                                                                                                                                                    | `push_records`: reject requests > 8 MB; at 250,000 rows per account refuse new records (updates still apply). App: batches ≤ 500 records and ≤ ~4 MB; a full cloud copy shows a clear "compact old history" message (`quota` reason). | same migration; `sync/engine.ts`, `sync/backend.ts`, `state/sync.ts`                      |
| V-11 | Low          | A valid session alone could delete the account.                                                                                                                                                                                                                                                                                                                                    | Edge Function requires a sign-in within 10 minutes (verified token's `amr` timestamps) → 403 `reauth`. The app runs the same check (same file) **before** deleting anything, so the cloud copy is never wiped first.                  | `supabase/functions/delete-account/{fresh,index}.ts`, `src/core/data/deleteEverything.ts` |
| V-09 | Low          | Any installed app could broadcast a fake widget tap.                                                                                                                                                                                                                                                                                                                               | Per-install SecureRandom secret in every tap intent, constant-time check in `onReceive`.                                                                                                                                              | `AscendWidget.java`, `WidgetStore.java`                                                   |

**Bug the tests found:** the first version revoked the internal helpers only from
`anon`/`authenticated`; the new test still could call them, because Postgres also grants
`EXECUTE` to `PUBLIC`. Fixed before commit.

**New tooling note (Low, pre-existing):** Android lint prints "Module was compiled with an
incompatible version of Kotlin (2.4 vs 2.2)" for `@capgo/capacitor-health` — non-fatal (also
in Phase 3's build); to be resolved with the Gradle/Kotlin update in Phase 9.

## 3. Tests and evidence

| Test                                                                                                                                                                                                                                                                                                               | Result                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| SQL (real migrations in PGlite, **now with Supabase's default grants**): anon can call nothing but `server_time`; users can call app functions but not internals/Ask tables; no function without `search_path`; full quota → updates OK, new rows refused atomically, other users unaffected; 8 MB request refused | 41/41 in `sql.test.ts` (5 new)            |
| `backend.test.ts`: `53400` → `quota`; other reasons unchanged; batches split at 500 records and by size, order kept, no record dropped                                                                                                                                                                             | 5/5 new                                   |
| `deleteEverything.test.ts`: stale sign-in refused before the cloud is touched; data-only delete still works; server 403 keeps the device; `amr` parsing; fresh/old/future/missing/garbage tokens                                                                                                                   | 9/9 (5 new)                               |
| Android `WidgetTokenTest` (JUnit): right token matches; null, empty, shorter, longer, different rejected; missing secret never matches                                                                                                                                                                             | 3/3                                       |
| `npm run check`                                                                                                                                                                                                                                                                                                    | Passed — 151 files, 872 tests             |
| Full e2e (phone + laptop)                                                                                                                                                                                                                                                                                          | 42 passed, 2 skipped (opt-in screenshots) |
| Android `assembleDebug` + `lintDebug`                                                                                                                                                                                                                                                                              | Built; 0 lint errors                      |

## 4. Remaining risks

- Not live until deployed. The Edge Function's freshness check was tested through the shared
  pure helper, not against the live auth server; after deploying, a manual check is advised:
  Delete everything with "Also delete my account" an hour after signing in → asks to sign in
  again, nothing deleted.
- Widgets already on the home screen ignore taps until they redraw (opening the app redraws
  them).
- Open owner decisions: V-05 (weekly backup location), V-07 (server-readable sync data), the
  dashboard sign-up switch.

## 5. Deployment (2026-11-11)

| Step                                       | Evidence                                                                                                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase db push --dry-run` → `db push`   | Only `20261111000000_db_hardening.sql` pending; applied                                                                                                                                                                    |
| Live anon probes after the migration       | `compact_my_records`, `sync_server_version`, `my_cloud_usage`, `sync_row_limit`, `sync_sort_key`, `push_records` → `42501 permission denied`; `ask_usage`/`ask_cache` → `42501` (were `[]`); `server_time` → still answers |
| `supabase functions deploy delete-account` | Uploaded `index.ts` + `fresh.ts`; anon call → `{"error":"signed_out"}` 401 (new response format, so the new code is live)                                                                                                  |
| `git push` (`e3b8177`) → Vercel            | Commit status `success`                                                                                                                                                                                                    |
| e2e against production                     | `security` + `smoke` + `account` specs: 16/16 passed (phone + laptop)                                                                                                                                                      |
| Still to do by the owner                   | The manual check in section 4 (account deletion an hour after signing in)                                                                                                                                                  |
