# PLAN.md — ASCEND

Short, practical plan. Game rules: SPEC.md 4.8 + DECISIONS.md. Task checklist lives in PROGRESS.md.

## 1. Architecture

```
React screens (read derived state, never write the DB)
   │  call
   ▼
recordAction(action)  ── validate (Zod) ── idempotency check
   │  one Dexie transaction: records + xp_events + days
   ▼
event bus (QuestCompleted, DayClosed, LevelUp, GoalChanged, ...)
   │
   ├─ progress engine  → level, stats, rank, streaks, shields (pure functions, cached in Zustand)
   ├─ achievements, system messages, goal planner, skill tree        (later phases)
   └─ widget bridge, notifications, sync queue                       (later phases)
```

- **Local-first**: IndexedDB via Dexie is the source of truth. Works fully offline with no account. `navigator.storage.persist()` on start.
- **Pure core**: XP, levels, ranks, streaks, day evaluation and rollover are pure TypeScript functions over plain records → easy to unit-test, identical on every device.
- **Derived state is recomputable**: progress is rebuilt from `xp_events`, `quest_instances`, `days` on start if the cache version or a checksum looks wrong, and from "Rebuild progress" in Settings.
- **One clock**: `core/time/clock.ts` provides `now()`; dev tools add an offset. All "which day is it" uses `dayOf(instant, timezone, dayStartHour)`.
- **Day rollover**: runs on app open/resume and on a timer at the day-start hour. Closes every unclosed past day in order (idempotent: run late, twice or after weeks → same result).
- **Feature flags**: `src/config/features.ts`. Unbuilt features are hidden, not disabled.
- **Android**: Capacitor wraps the same web build. Native Kotlin only for widgets + Health Connect (Phase 10).
- **Sync (Phase 7)**: Supabase. UUIDs + deterministic instance ids, per-record last-write-wins by HLC, `xp_events` append-only deduped by idempotency key, `days` recomputed after sync.
- **AI (Phase 8)**: Supabase Edge Function proxy holds the key; client talks to an `AIProvider` interface; output validated with Zod.

Stack: React 19 + TypeScript strict + Vite, Tailwind v4 on CSS-variable tokens, React Router, Zustand, Dexie, Zod, Recharts, Lucide, vite-plugin-pwa, Capacitor. Tests: Vitest (+ fake-indexeddb), Playwright. No stack change from the spec.

## 2. Folder structure

```
src/
  app/            router, layout (bottom bar / sidebar), error boundary, update prompt
  config/         game.ts (all XP/level/rank numbers), features.ts (flags)
  core/
    time/         clock, dayOf, weeks, timezone helpers
    db/           schema types, Dexie db, migrations, persistence
    pipeline/     recordAction, action definitions, event bus
    engine/       xp, levels, ranks, days, streaks, rollover, progress (pure)
    planner/      goal planner (Phase 3)
    achievements/ (Phase 5)
  data/           starter habits, achievements, plan templates, skill seeds
  features/       one folder per screen: today, quests, focus, goals, body, review, profile, skills, jobs, settings, onboarding
  ui/             shared components (Button, Card, Sheet, ProgressBar, StatBadge…)
  styles/         tokens.css, base.css
  dev/            developer tools (imported only when import.meta.env.DEV)
scripts/simulate.ts
e2e/              Playwright tests
android/          Capacitor project
supabase/         SQL migrations + edge functions (Phase 7–8)
```

## 3. Data model (complete in Phase 1)

All tables from SPEC.md section 10, plus `meta`, `plan_proposals`, `photos`. (Crash log: localStorage, see DECISIONS.) Every record: `id` (UUID or deterministic), `created_at`, `updated_at`, `deleted_at`, `schema_version`, `hlc`.

| Table                   | Key fields / notes                                                                                                                                                                                                                         | Indexes                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| profile                 | name, start_day, display_title                                                                                                                                                                                                             | —                         |
| settings                | day_start_hour (3), week_start (mon), wake_time (05:00), wake_window_min (20), **wake_late_cutoff (07:00)**, theme, notifications, quiet_hours, ai_enabled, ai_monthly_budget, auto_plan, health_connect_enabled, photo_sync, jobs_enabled | —                         |
| dreams                  | title, why, status, order, planner_context                                                                                                                                                                                                 | status                    |
| main_quests             | dream_id, title, why, stat, target_date, status, planner_context                                                                                                                                                                           | dream_id, status          |
| milestones              | main_quest_id, title, size_weight, target_type, target_value, current_source, estimated_weekly_quests, target_date, status, done_at, planner_context, order                                                                                | main_quest_id             |
| habits                  | title, stat, difficulty, schedule[weekdays], full_version, min_version, measure, target_value, min_value, core, auto_source, linked_goal_type/id, skill_ids, status, planned_by, order                                                     | status                    |
| quests                  | type weekly/side/recovery, title, stat, difficulty, measure, target_value, linked_goal_*, skill_ids, week_start / due_day, status, planned_by, carried_over_from                                                                           | type, week_start, due_day |
| quest_instances         | id = `habit_id:day` / `quest_id:week_start` / `quest_id`; source_type, source_id, day, status, title/difficulty/target snapshots, completed_at, completed_via, award_revision                                                              | day, [source_id+day]      |
| progress_entries        | quest_instance_id, source, amount, occurred_at                                                                                                                                                                                             | quest_instance_id         |
| days                    | day (PK), timezone, active, neutral, daily_clear, low_energy, shield_used, shields_after, repaired, streak_at_start, closed_at                                                                                                             | day                       |
| focus_sessions          | quest_instance_id or stat, skill_ids, planned_min, actual_min, completed, started_at, ended_at, day                                                                                                                                        | day                       |
| body_logs               | day, weight, waist, sleep_hours, steps, workout_notes, photo_id, source                                                                                                                                                                    | day                       |
| photos                  | blob, day — local only, never synced, excluded from JSON export                                                                                                                                                                            | day                       |
| reviews                 | type, period, energy, mood, win, lesson, text                                                                                                                                                                                              | [type+period]             |
| xp_events               | day, occurred_at, stat, base_amount, reason, idempotency_key (unique), ref_type, ref_id — append-only                                                                                                                                      | day, &idempotency_key     |
| achievements_unlocked   | achievement_key, unlocked_at                                                                                                                                                                                                               | achievement_key           |
| skills / skill_evidence | branch, name, parent_id, order, manual_level_override / skill_id, type, ref_id, minutes, note, link                                                                                                                                        | skill_id                  |
| job_applications        | company, role, link, source, applied_at, stage, stage_history, salary_range, notes, follow_up_at, linked_quest_instance_id                                                                                                                 | stage, follow_up_at       |
| plan_history            | goal_type, goal_id, trigger, summary, changes[{entity,id,before,after}], source, created_at, undone_at                                                                                                                                     | goal_id                   |
| plan_proposals          | goal_type, goal_id, items, status (pending/applied/rejected), auto_apply_at                                                                                                                                                                | status                    |
| pending_actions         | action, payload, occurred_at, source, processed_at                                                                                                                                                                                         | processed_at              |
| meta                    | key, value                                                                                                                                                                                                                                 | —                         |

Migrations: Dexie versioned `version(n).upgrade()`; export files carry `app_version` + `schema_version`, and importers upgrade old files step by step.

## 4. Balance (SPEC 4.8)

Model: 8 starter habits (≈180 base XP/day if all done at full); core quests done 90% of days, others 72%; 75% of done quests at full; 10% low-energy days (core minimums only); about two 4–13 day breaks per year; shields and streak bonus as specified; 20 simulated users averaged.

`round(50·n^1.4)` (spec's starting formula) reaches only level ≈48 by year 5. Chosen: **`round(80·n^1.15)`**:

| Year | Level | STR | INT | WIL | Active days | Rank |
| ---- | ----- | --- | --- | --- | ----------- | ---- |
| 1    | 27    | 15  | 17  | 13  | 257         | B    |
| 2    | 37    | 21  | 24  | 19  | 508         | B    |
| 3    | 45    | 26  | 30  | 23  | 766         | A    |
| 4    | 52    | 30  | 34  | 26  | 1024        | A    |
| 5    | 58    | 33  | 38  | 29  | 1274        | S    |

Ranks: D L5+14 · C L15+90 · B L25+250 · A L40+600 · S L55+1150 active days.
_(This is from a quick prototype. Task 1.8 rebuilds it as `scripts/simulate.ts` using the real config and engine, and replaces this table with its output.)_

## 5. Build phases and tasks

Each task: ~1–5 files, app builds and runs afterwards, type-check + tests pass, one commit, push.

### Phase 1 — Foundation

- 1.1 Scaffold Vite + React + TS strict, ESLint + Prettier, Vitest; README, CHANGELOG, .gitignore, .env.example; git init, first commit, push to private `ascend` repo
- 1.2 Design tokens (CSS variables, light/dark + darker text variants), Tailwind v4 wiring, bundled Inter + Space Grotesk, theme switch (system/light/dark), WCAG contrast unit test
- 1.3 App shell: router, 5-tab bottom bar, desktop sidebar, More page, feature-flag file, error boundary with "Export my data"/"Reload", local error log
- 1.4 Time module: clock with dev offset, `dayOf`, week start, day N; tests (midnight, day-start, tz change, leap years, DST zone)
- 1.5 Schema: all record types + Dexie DB v1 (all tables + indexes), migration runner before first render, `storage.persist()`; tests
- 1.6 `config/game.ts` + level/stat-level/rank pure functions + tests
- 1.7 Action pipeline: `recordAction`, Zod validation, idempotency, single transaction, event bus; tests with fake-indexeddb
- 1.8 `scripts/simulate.ts` using real config/engine; update PLAN.md Balance table
- 1.9 PWA: manifest, service worker, offline, original app icon (SVG → all sizes), calm "Update ready — reload" prompt
- 1.10 Developer tools panel (dev only): change date/time, jump N days, reset all data
- 1.11 Capacitor Android shell + README Windows/Android Studio step-by-step (debug APK, USB debugging)
- 1.12 Playwright smoke test, Vercel deploy (README steps), phase wrap-up

### Phase 2 — Core loop _(then 1 week of daily use)_

- 2.1 Habit actions (create/edit/pause/archive/restore/reorder, core max 3) + daily instance generation with deterministic ids + tests
- 2.2 XP engine: day total in order of operations, min→full top-up, compensating events, Daily Clear; tests
- 2.3 Completion actions: full/min tap, progress entries, wake check-in (on time / late / after 7:00 missed), same-day un-tick, closed-day guard, late-arriving actions; tests
- 2.4 Day evaluation: active / neutral / Daily Clear / low-energy; tests
- 2.5 Streaks, shields, repair, per-habit streaks (progress engine) + tests
- 2.6 Day rollover job + Recovery quest + welcome-back; tests (late, twice, 30 days away, tz change)
- 2.7 Derived-state store (Zustand), startup consistency check, "Rebuild progress"
- 2.8 Onboarding "Awakening" (5 steps, pre-filled from DECISIONS, start today/tomorrow)
- 2.9 Today part 1: header (level, XP bar, rank, streak, 3 stats), quest cards (Full/Minimum taps, number inputs, "I'm up")
- 2.10 Today part 2: low-energy mode, System message templates, Recovery card, complete animation + XP float
- 2.11 Quests screen (Daily tab): create/edit/reorder/pause/archive/restore habits
- 2.12 Settings (phase-2 parts): theme, day-start, week start, wake time/window/cutoff, core quests, version, rebuild, reset
- 2.13 Export/import JSON (Zod-validated, versioned, auto-export first, replace/merge) + web backup reminder; tests
- 2.14 Dev tools: generate years of realistic test data
- 2.15 E2E: onboarding, complete quest, low-energy day, export → wipe → import; phase wrap-up

### Phase 3 — Goals + Goal Planner (rules)

- 3.1 Goal actions (dreams/main quests/milestones; pause/finish/archive/restore) + goal progress calc + tests
- 3.2 Vision & Goals screens (tree with progress, "why this matters")
- 3.3 Weekly + side quests: actions, Quests tabs (Weekly/Main/Side), Today "This week"
- 3.4 Planner templates (data files) + analyze/interview/plan engine + tests
- 3.5 Planner sheet UI: interview (chips/sliders), `planner_context` saved
- 3.6 Impact preview + approve/edit items; linked habits handling on pause/finish/archive
- 3.7 Plan history + exact undo
- 3.8 Weekly generation, auto-apply on week start with Undo, carry-over
- 3.9 Follow-ups: next milestone, deadline-risk options, 30-day check-in
- 3.10 Planner run for onboarding goals; E2E goal change → planner → approve → undo

### Phase 4 — Focus & Body

- 4.1 Focus timer engine + session actions (linked → minutes, unlinked → 1 XP/min, abandon) + tests
- 4.2 Focus screen + minimal full-screen + face-down honesty check
- 4.3 Session history
- 4.4 Body log actions + Body screen (weight, waist, sleep, steps, workouts)
- 4.5 Local photos + "Export with photos" .zip
- 4.6 Trend charts; E2E focus linked to quest (no double XP)

### Phase 5 — Reviews & progress

- 5.1 Daily check-in · 5.2 Weekly review flow (confirms planner proposals) · 5.3 Monthly/yearly summaries
- 5.4 Profile: radar, XP history, multi-year heatmap · 5.5 Achievements (~40, data file) + engine + tests
- 5.6 Titles · 5.7 Level-up / rank-up moments (skippable, reduce-motion) · 5.8 Difficulty suggestions (6.1) + E2E level up

### Phase 6 — Notifications

- 6.1 Notification service (Capacitor local vs in-app/browser) · 6.2 Wake-up check-in notification (tap time counts)
- 6.3 Morning briefing, quest reminders, 9 PM wind-down · 6.4 Quiet hours, 7-day-away pause, rescheduling in rollover, honest Settings text

### Phase 7 — Sync & accounts

- 7.1 Supabase SQL schema + RLS + migrations · 7.2 Auth (magic link + Google) · 7.3 Sync engine (push/pull, HLC LWW, xp_events dedupe)
- 7.4 Recompute `days` after sync · 7.5 First sign-in merge/keep/cloud flow with auto-export · 7.6 "Sync paused" handling
- 7.7 Android weekly local backup file · 7.8 Sync tests (all four in SPEC 11)

### Phase 8 — AI coach

- 8.1 `AIProvider` + Claude implementation in Edge Function · 8.2 Budget, rate limit, cache · 8.3 AI Goal Planner with Zod-validated JSON
- 8.4 Auto-plan mode with Undo · 8.5 Weekly review summary, brain-dump → quests, "what now?" · 8.6 Guardrails + tests

### Phase 9 — Career tools

- 9.1 Skills data + evidence + computed levels · 9.2 Skill tree UI + 70/30 balance
- 9.3 Job tracker actions + auto side quest · 9.4 Jobs list/board + stats · 9.5 Follow-up reminders + planner hooks

### Phase 10 — Android native & polish

- 10.1 Health Connect plugin + auto-complete · 10.2 Widget snapshot + Kotlin widgets · 10.3 Pending-actions queue
- 10.4 App icon/splash · 10.5 Accessibility pass · 10.6 10-year performance test · 10.7 Final README
