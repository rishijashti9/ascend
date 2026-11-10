# Production hardening — Phase 8: testing, debugging and regression verification

Date: 2026-11-11 · Builds on [phase-7-ai-third-party.md](phase-7-ai-third-party.md).
**Status: verified locally, committed, NOT deployed** (one performance fix in the app → push).

## 1. Test inventory by type (all executed in this phase)

| Type                                  | Where                                                                                                                                                                                                                                                                                  | Result                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Unit                                  | Vitest, 155 files (engine, pipeline, adaptive, compass, planner, screen time, sync merge, time, UI pieces)                                                                                                                                                                             | **894 passed**                                                            |
| Integration                           | Same run: actions through the real pipeline on fake IndexedDB; two-device sync through an in-memory cloud with the server's rules; import/export round trips; old DB versions upgraded                                                                                                 | included above                                                            |
| Database / authorization              | `sql.test.ts`: the real migrations in Postgres (PGlite) with Supabase's default grants — RLS isolation, anon denial, least privilege, quota, sign-up allow-list                                                                                                                        | 41 passed (in the run above)                                              |
| End-to-end                            | Playwright, phone + laptop: onboarding, core loop, low-energy day, level-up, focus (no double XP), goals → planner → approve → undo, export → wipe → import, photos, notifications, account, career, Phase 8/11 flows, offline, axe accessibility on every screen, CSP on every screen | **42 passed**, 14 skipped by design (screenshots opt-in; live-API opt-in) |
| API / security regression (live)      | **New** `e2e/live-api.spec.ts` (`LIVE_API=1`): anonymous access to data, Ask tables and 8 RPCs refused; only `server_time` open; allow-list schema not exposed; both functions need a user; CORS allow-list; live headers                                                              | **6/6 passed against production**                                         |
| Authentication                        | Fresh sign-in rule (`deleteEverything.test.ts`), PKCE/auth redirect handling, sign-in expiry → "sign in again" status, account linking choices (`link.test.ts`)                                                                                                                        | passing (in unit run)                                                     |
| Android                               | JUnit `WidgetTokenTest` + example; emulator run of the real app under CSP (Phase 6)                                                                                                                                                                                                    | 4/4 passed                                                                |
| Performance                           | `npm run perf` — 13 timings with ten years of data; heap/listener test (Phase 6)                                                                                                                                                                                                       | **failed once → fixed → 13/13 within budget**                             |
| Simulation / regression of game rules | `npm run simulate` — XP pacing, ranks, adaptive difficulty over simulated users                                                                                                                                                                                                        | all checks ✓                                                              |
| Failure and recovery                  | Damaged/newer backups refused; crash → error screen with Export; sync paused/offline/back-off; **new: cloud copy full → clear message, data kept, recovers**; storage full; long absence rollover; timezone changes; offline after first visit                                         | passing                                                                   |

## 2. Bugs found and fixed

| #   | Sev.                 | Bug                                                                                                                                                                                                                         | Root cause                                                                                                                       | Fix                                                                                                                                         | Evidence                                                            |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| B-1 | Medium (performance) | **Planner state 1,527 ms** with ten years of data (budget 500 ms). Runs when planning and in weekly flows, so a long-time user would feel it. Pre-existing — not caused by the hardening (Zod jitless measured at ~5–10 %). | `loadAdaptiveInput` fetched progress entries with `anyOf(~285 ids)`: one index scan per id (1,429 ms of it, measured per query). | Read by the `day` index for the same window and filter by instance (identical rows: daily-quest entries always carry their instance's day). | 1,527 → **35 ms**; adaptive + planner tests 76/76; full suite green |

Other `anyOf` uses were checked: all bounded to a handful of keys (one week, today, two dates).

## 3. New tests

- `e2e/live-api.spec.ts` (6) — live security regression, opt-in.
- `link.test.ts` — full cloud copy: plain message, data kept on the device, clears when there's room.
- `MemoryCloud` can now simulate a full quota.

## 4. Not covered (and why)

- Deno unit test `supabase/functions/ask/openrouter_test.ts` — no Deno on this laptop. Its logic
  runs live (deploys bundle it); `guard.ts` is covered through Vitest. Installing Deno is a
  download I'd only do with your OK.
- Code-coverage percentage — would need a new dev dependency (`@vitest/coverage-v8`); not added
  without your OK. Coverage was assessed by area instead (section 1).
- Authenticated live tests (real account): need your sign-in.

## 5. Results summary

`npm run check` (type-check, lint, format, 894 tests) ✓ · e2e 42 ✓ · live API 6 ✓ · perf 13/13 ✓
· simulate ✓ · Android JUnit 4 ✓.
