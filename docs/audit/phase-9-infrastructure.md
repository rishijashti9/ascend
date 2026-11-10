# Production hardening — Phase 9: infrastructure and deployment readiness

Date: 2026-11-11 · Builds on [phase-8-testing.md](phase-8-testing.md).
**Status: on branch `hardening/ci`, CI green, NOT merged to `main` / NOT deployed.**

## 1. What was inspected

Deployment pipeline (none existed — Vercel built every push to `main` with no tests),
environments, secrets, backups and disaster recovery, monitoring/alerting, rollback, dependency
updates, HTTPS/TLS (HSTS preload on Vercel; Supabase HTTPS-only — verified in earlier phases).

## 2. Findings and changes

| ID    | Sev.   | Finding                                                                              | Change                                                                                                                                                                                                                                                                      |
| ----- | ------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-06  | Medium | No CI / deploy gate.                                                                 | `.github/workflows/ci.yml`: `npm run check`, full e2e (phone + laptop), Android JUnit + APK + lint on every push to `main`/`hardening/**` and every PR. Read-only token, no secrets, checkout token not persisted, actions pinned to commit SHAs of releases ≥ 2 weeks old. |
| V-08  | Medium | DR undocumented; Supabase Free has **no automatic backups or PITR** (Supabase docs). | `docs/operations/RUNBOOK.md`: per-scenario recovery (devices + exports are the backups; full schema rebuild from migrations is tested), backup routine, rollback per component with undo SQL, secret rotation.                                                              |
| V-16  | Low    | Dev-tool advisories; no update process.                                              | Dependabot (weekly npm + actions, monthly Gradle, grouped); advisories reviewed — all fixes are major **downgrades** of build/lint tools, accepted and documented.                                                                                                          |
| MON-1 | Medium | No monitoring or alerting.                                                           | `.github/workflows/live-checks.yml`: daily 06:00 IST read-only security + availability checks against production; GitHub emails on failure. Runbook lists every signal.                                                                                                     |
| ENV-1 | Medium | Dev, previews and production share one Supabase project.                             | Documented; recommended a second free project for development (needs you). Tests never sign in, so they don't touch account data.                                                                                                                                           |

## 3. Bugs CI found (each fixed, each invisible on this laptop)

| #    | Bug                                                                     | Root cause                                                                                                                                                          | Fix                                                                                                                                                                              |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI-1 | 4 unit tests failed on the runner                                       | Tests expect Indian-English dates ("1 Oct 2027"); the US runner shows "Oct 1, 2027". App behaviour is correct (device locale).                                      | Unit-test step runs with `LANG=en_IN.UTF-8`, `TZ=Asia/Kolkata`; Playwright pins `locale: 'en-IN'`.                                                                               |
| CI-2 | "window is not defined" — 2, then 1 unhandled errors                    | Tests ended while an action's promise was still settling (the screen updates from the database first); React then updated after the test environment was torn down. | `recordAction` counts in-flight actions; `actionsSettled()`; the shared test setup waits for it after every test (capped 3 s). Global, not per file. New unit test.              |
| CI-3 | Export/import and photo e2e couldn't upload their file                  | The `en_IN` locale isn't installed on the runner; with it set job-wide, Chromium mishandled the non-ASCII file path.                                                | Locale scoped to the unit-test step only.                                                                                                                                        |
| CI-4 | Console warning `Permissions-Policy: Unrecognized feature: 'bluetooth'` | Not a feature Linux Chromium knows (Windows Chromium accepts it, so it never showed locally). My Phase 3 header.                                                    | Removed from `vercel.json`; `security.spec.ts` now fails on Permissions-Policy/CSP console warnings (verified: it is the Linux browser that reports it, which is where CI runs). |

## 4. Evidence

| Run                       | Result                                                                         |
| ------------------------- | ------------------------------------------------------------------------------ |
| CI #1 (`42809954550`)     | Check failed (CI-1); Android ✓                                                 |
| CI #2 (`42811979473`)     | 894/894 tests ✓, 2 unhandled errors (CI-2)                                     |
| CI #3 (`42814065401`)     | 1 unhandled error (CI-2, second file)                                          |
| CI #4 (`42816033901`)     | Check ✓; e2e 38 ✓ / 4 ✘ (CI-3, CI-4)                                           |
| **CI #5 (`42819086491`)** | **All green: check ✓ (896 tests), e2e 42 ✓ (14 skipped by design), Android ✓** |
| Local                     | `npm run check` ✓ 896; affected e2e specs 14/14 ✓                              |

## 5. Needs you (GitHub / Supabase settings — not changed by me)

1. **Branch protection** on `main`: require the `CI` checks to pass before merging (GitHub →
   Settings → Branches). Until then CI reports but doesn't block; Vercel still deploys `main`.
2. **Approve merging `hardening/ci` into `main`** (that deploys: the header fix and the test
   changes go live; the workflows start running from `main`, incl. the daily live check).
3. Optional: a second Supabase project for development (runbook §2).
4. Make sure GitHub Actions failure emails are on (Settings → Notifications → Actions).

## 6. Remaining risks

- CI doesn't gate Vercel until branch protection is on and changes go through PRs.
- Supabase Free: no server-side backups — device copies + your monthly export are the safety net.
- The daily live check can only run from `main` (scheduled workflows run on the default branch).
