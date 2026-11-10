# Production hardening — Phase 6: frontend quality and performance

Date: 2026-11-11 · Builds on [phase-5-backend-api.md](phase-5-backend-api.md).
**Status: verified locally, committed, NOT deployed** (push to `main` deploys the web app; the
Android change reaches the phone with the next APK install).

## 1. What was inspected and measured

Bundle composition (source maps), cold and returning-user load performance on a throttled
phone profile, memory over long sessions, event listeners/timers/subscriptions, sync network
behaviour, error and loading states, and the Android app's script policy. Existing coverage
for accessibility (axe on every screen), responsive layouts (phone + laptop e2e), error screens
and offline use was reused, not rebuilt.

## 2. Findings

| ID  | Sev.                            | Finding                                                                                                                                                                                                          | Outcome                                                                                                                                                           |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1 | Low                             | One 1.42 MB JS bundle (421 KB gzip); react-dom 15 %, Supabase SDK ~21 %, router 9 %, Zod 9 %, Dexie 7 %, app code 34 %.                                                                                          | Route code-splitting **built, measured, reverted** — no gain where it counts (table below).                                                                       |
| P-2 | Info                            | First-run onboarding blocks the main thread ~750 ms on a 4×-throttled phone; the daily path (Today) ~290 ms.                                                                                                     | Accepted: onboarding is seen once; Today's numbers are in the "needs improvement" band but acceptable, and the remaining cost is libraries Today genuinely needs. |
| M-1 | Info                            | No memory leak: 30 laps through 13 screens with forced GC — JS event listeners constant (232), DOM nodes constant (666), heap +1 MB in the first 10 laps (warm-up) then ~15 KB/lap (test's own history entries). | No change needed.                                                                                                                                                 |
| M-2 | Info                            | Listener/timer audit: every component listener is removed on unmount; remaining ones are app-lifetime (installed once).                                                                                          | No change needed.                                                                                                                                                 |
| N-1 | Info                            | Sync: 5 s after a change, every 5 min, on resume/reconnect; back-off 1/5/15/60 min while failing; a round with no changes is one small pull.                                                                     | No change needed.                                                                                                                                                 |
| C-1 | Medium (Phase 3 remaining risk) | **Android app had no CSP** (local files, no HTTP headers).                                                                                                                                                       | `<meta>` CSP in `index.html`, identical to the header (test-enforced). Verified on Android (below).                                                               |
| C-2 | Info                            | Capacitor's `SystemBars` logs "Error injecting safe area CSS" at start-up (its script runs before `<html>` exists).                                                                                              | Capacitor timing quirk, unrelated to CSP; the app uses CSS `env()` for safe areas.                                                                                |

### Code-splitting experiment (P-1)

| Returning user opens Today — Pixel 7 profile, 4× CPU, no cache, 7 alternating runs (median) | Before   | Split    |
| ------------------------------------------------------------------------------------------- | -------- | -------- |
| Today visible                                                                               | 1,382 ms | 1,403 ms |
| Largest Contentful Paint                                                                    | 840 ms   | 1,112 ms |
| Total blocking time                                                                         | 286 ms   | 306 ms   |
| JS loaded                                                                                   | 410 KB   | 365 KB   |

## 3. Tests and evidence

| Test                                                                                                                                                                                                                                  | Result                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/csp.test.ts`: header and meta policies exist, have identical directives except `frame-ancestors`, and never allow inline/eval scripts                                                                                     | 3/3 new                                                                                                                                                                                                         |
| **Android emulator** (API 37, debug APK, WebView driven over DevTools): meta CSP present; injected inline script **refused** (enforced); onboarding completed; 15 screens visited; screenshots of Today and Settings render correctly | 0 CSP violations; only console error `ERR_NAME_NOT_RESOLVED` (emulator offline)                                                                                                                                 |
| Heap/listener test (30 laps) and load probes                                                                                                                                                                                          | As in section 2                                                                                                                                                                                                 |
| `npm run check`                                                                                                                                                                                                                       | Passed — 154 files, 882 tests                                                                                                                                                                                   |
| Full e2e (phone + laptop), with the meta CSP                                                                                                                                                                                          | 42 passed, 2 skipped (opt-in screenshots). An earlier run at default parallelism had 2 core-loop failures; re-run alone 8/8 and the full suite at 2 workers passed — load on this 8 GB laptop, not a code issue |

## 4. Remaining risks

- Sign-in on Android under the meta CSP (Google / email link return) wasn't exercised (emulator
  offline, needs your account). `connect-src` allows the Supabase project and sign-in pages
  open in the system browser, so no impact is expected — please sign in once after installing
  the next APK.
- Start-up cost is dominated by libraries; deferring Supabase for signed-out users would help
  others but not you (you're signed in).
