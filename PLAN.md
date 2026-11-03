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
- **Phase 8 (SPEC 6.7)**: on-device Adaptive System (`core/adaptive`, pure models over stored records) and Growth Compass (`core/compass` + versioned knowledge pack in `data/compass`); compaction summaries (`core/compaction`); optional Ask the System via an `AIProvider` interface and a Supabase Edge Function holding `GEMINI_API_KEY`; AI output validated with Zod.

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

`npm run simulate` (`scripts/simulate.ts`) models a realistic user for 5 years with the real config and level curve: Rishi's 8 starter habits (≈180 base XP/day if all done at full); core quests done 90% of days, others 72% (≈80% overall); 75% of done quests at full; 10% low-energy days (core minimums only); about two 4–13 day breaks per year; shields, Recovery-quest repairs and the streak bonus as in DECISIONS.md; 20 users averaged.

The spec's starting curve `round(50·n^1.4)` reaches only level ≈48 by year 5, because XP grows roughly linearly with time. Chosen: **`round(80·n^1.15)`**.

Ranks: D L5+14 · C L15+90 · B L25+250 · A L40+600 · S L55+1150 active days.

Output (seed 1, 20 users; 100 users with seed 42 gives the same levels):

| Year | Level | STR | INT | WIL | Active days | Longest streak | Rank |
| ---- | ----- | --- | --- | --- | ----------- | -------------- | ---- |
| 1    | 27    | 15  | 18  | 14  | 259         | 36             | B    |
| 2    | 38    | 22  | 25  | 19  | 513         | 46             | B    |
| 3    | 46    | 26  | 30  | 24  | 771         | 53             | A    |
| 4    | 53    | 30  | 35  | 27  | 1025        | 56             | A    |
| 5    | 59    | 34  | 39  | 30  | 1278        | 57             | S    |

✓ Year 1 level 27 within 25–30
✓ Year 5 level 59 within 55–60
✓ Earliest rank S: year 4.3 (not before year 4)
✓ Users reaching S within 5 years: 20/20

### Adaptive difficulty (Phase 8, `npm run simulate`, second table)

30 simulated users with one minutes quest each and a real sustainable amount (40–140 min/day); 3 in 4 start above it. Missing the full target again and again also makes them skip the minimum more often. With the Adaptive System on, the real `difficultySuggestion` runs every day and 80 % of suggestions are accepted. Last 90 days of year 1:

| Targets  | Done (≥ minimum) | Done in full |
| -------- | ---------------- | ------------ |
| Fixed    | 73%              | 40%          |
| Adaptive | 92%              | 81%          |

✓ No raise within a month of an ease (0) · ✓ at most 4 direction changes a year (avg 4.4 changes) · ✓ 30/30 targets settle within 25 % of real capacity. Same picture for seeds 1–4 (asserted in `simulateAdaptive.test.ts`).

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

### Phase 8 — Adaptive System + Growth Compass + Ask the System (SPEC 6.7; replaces the AI coach)

Build order A → B → D → C. Version 0.10.0 at the end. New tables in schema v2 (Dexie `version(2)` with upgrade; all synced through the generic `sync_records`, so no server table migration): `learning_events`, `summaries`, `compactions`. New settings fields get defaults in the upgrade.

**Part A — Adaptive System**

- 8.1 Schema v2: `learning_events`, `summaries`, `compactions` types + Dexie v2 upgrade (existing rows untouched, new settings defaults), backup format upgrade (v1 files still import), SYNCED_TABLES; upgrade test on a v1 database with real-shaped data
- 8.2 Recording I: `learning.record` action; suggestion events from every existing card (difficulty, planner proposals, goal nudges, job suggestion, follow-ups — shown/accepted/edited/rejected/ignored); app-open events; tests
- 8.3 Recording II: notification events (scheduled from the scheduler, delivered when the plugin reports it, opened on tap, minutes to the related action); week planned-vs-actual written when a week closes; tests
- 8.4 Adaptive core (pure): recency-weighted Beta-Bernoulli per quest × weekday, priors/cold start, recency-weighted averages, confidence levels, reset markers; calibration test
- 8.5 Learned best hours, real weekly capacity, suggestion-type acceptance weights; tests
- 8.6 Today suggestion slot (one card, priority list) + "At risk today" highlight + "What should I do now?" engine and card; tests
- 8.7 Adaptive difficulty toward ~80% (dead band, cooldown, never below minimum, never less sleep, not in low-energy streaks) replacing 5.8's 3/7-day rules; tests
- 8.8 Best times → reminder/focus time suggestions (approval) + planner and weekly plan sized to learned capacity; tests
- 8.9 Goal guidance: pace forecasts for milestones / main quests, early behind warning + catch-up options, focus goal of the week (weekly plan + weekly review); tests
- 8.10 Burnout early warning (completion slope + low-energy days + short sleep) → lighter week proposal; tests
- 8.11 "What the System knows about you" page (plain words, confidence, clear item), reset learning per habit / overall, learning CSV export
- 8.12 `scripts/simulate.ts` adaptive users (adherence improves, no oscillation) + Part A wrap-up

**Part B — Growth Compass**

- 8.13 Knowledge pack format (Zod), loader, sources + O*NET attribution, "check the official site" flags; scope classifier (career / health / off-topic); tests
- 8.14 Career data: careers with RIASEC codes + ESCO/O*NET links, career → skill graph with prerequisites, mapping to the skill tree
- 8.15 Learning roadmaps and guides data (AI/ML, ROS 2, C++, robotics math, simulation, Unreal; IELTS, GRE, APS/Germany with step durations; study science)
- 8.16 Career discovery assessment (RIASEC + strengths + values) engine + UI with explained matches
- 8.17 Career gap analysis → roadmap → Goal Planner proposal (approval, undo), readiness forecast from real pace
- 8.18 Health knowledge (WHO activity/sleep/diet, ICMR-NIN) + health safety engine (no diagnosis, doctor referral, safe weight rate, sustained low mood → verified helpline); tests
- 8.19 Health check-in + gap analysis vs WHO from real local data
- 8.20 Health roadmap → Goal Planner proposal; career–health balance in weekly plans; tests
- 8.21 Compass screen (More → Compass: Career / Health, sources), `compass` flag on
- 8.22 Onboarding starter templates by goal type (fitness, study/exams, career/skills, discipline; current set = one template)

**Part D — Data ownership and storage**

- 8.23 Settings → My data: what's stored, device + cloud space (new SQL function `my_cloud_usage()`), outbound log, export buttons
- 8.24 Delete everything: final export → local wipe → cloud reset → optional account deletion (Edge Function `delete-account`); tests
- 8.25 Compaction summaries builder (pure): week/month summaries from detail; tests
- 8.26 Engines read summaries + detail (progress, streak history, heatmap, period stats, profile, skills, achievements facts, adaptive); invariant tests (identical progress)
- 8.27 `data.compact` action: preview (what + space saved), auto export first, apply, compaction history; sync of compactions (push skips compacted rows, peers apply, server `compact_my_records()`); export/import + sync tests
- 8.28 Size notice + compaction UI in My data

**Part C — Ask the System**

- 8.29 `AIProvider` interface + Edge Function `ask` (Gemini provider, Search grounding, daily limit + cache in SQL) — stop to give Rishi the PowerShell secret command
- 8.30 Context builder (allow-list, never health/journal/mood/photos), local scope gate, calm fallback to Compass (quota, offline, signed out, no key); tests
- 8.31 Ask the System screen (sources, Google note, Settings switch), answer → suggested quests via a plan proposal (approval, undo), outbound log
- 8.32 Phase 8 wrap-up: E2E, README, CHANGELOG, v0.10.0 (versionCode 10)

### Phase 9 — Career tools

- 9.1 Skills data + evidence + computed levels · 9.2 Skill tree UI + 70/30 balance
- 9.3 Job tracker actions + auto side quest · 9.4 Jobs list/board + stats · 9.5 Follow-up reminders + planner hooks

### Phase 10 — Android native & polish

- 10.1 Health Connect plugin + auto-complete · 10.2 Widget snapshot + Kotlin widgets · 10.3 Pending-actions queue
- 10.4 App icon/splash · 10.5 Accessibility pass · 10.6 10-year performance test · 10.7 Final README

### Phase 11 — Digital Discipline (SPEC 6.8)

Everything off by default, nothing ever blocked. Version 0.11.0 at the end. New tables in schema v3 (Dexie `version(3)`, existing tables and records untouched; synced through the generic `sync_records`, so no server table migration): `screen_days` (one record per device per day: seconds per app/domain, plus seconds inside focus sessions), `screen_rules` (singleton: parts switched on, categories overrides, limit, study hours, wind-down, interval, DND pass-through, pending looser changes with their date), `screen_locks` (start, end, extensions), `screen_events` (breaks, "5 more", incidents, reminder button taps), `free_time` (planned free time blocks). Shared pure logic in `src/core/screentime/` is used by the app and the extension. Laptop extension in `extension/` (TypeScript, built with Vite into `extension/dist`, loaded unpacked).

- 11.1 Schema v3: the five tables' types + Dexie v3 upgrade (nothing existing changes), backup format (v1/v2 files still import), SYNCED_TABLES, `screenTime` feature flag (off until 11.19); upgrade test on a v2 database
- 11.2 Categories (pure): default Entertainment domains + phone packages (data file), domain normalisation (subdomains → domain), category resolution with overrides, phone browsers Neutral, YouTube = Work/Study inside focus; tests
- 11.3 Locks + trusted time (pure): lock periods and 7-day extensions, stricter/looser classification of every rule change, pending looser changes with their date, trusted time (server `Date` header, never the device clock alone), strictest-first merge for sync/import; tests (clock forward/back, import, re-categorise attempts)
- 11.4 Rule actions: switch parts on/off, set limit / study hours / wind-down / interval / DND pass-through / categories, choose a lock, apply pending changes when the lock ends (rollover); sync merge holds looser incoming rules as pending; import and Delete everything keep active locks; tests
- 11.5 Trigger engine (pure): which trigger is active at a moment (over limit, study hours or focus, wind-down), planned free time, quiet hours, break (20 min, max 2/day in a lock), "5 more minutes" (once a day), re-alert interval, calm notification text; tests
- 11.6 Planned free time + reminder button actions (12 h ahead, max 2 a week, no short-notice create/extend in a lock; break, 5 more, start focus as `screen_events`); tests
- 11.7 Observe week + suggestions (pure + action): 7 days measuring only, then a suggested limit, study hours and wind-down from real data, accept/edit with a lock choice; tests
- 11.8 Android native I: Usage-stats plugin (Usage access check / open settings, daily totals per app for a day range, foreground app now, app labels) + JS bridge writing the phone's `screen_days` on open/resume; tests with a mocked plugin
- 11.9 Android native II: screen-time notification channel (separate; DND bypass when access is granted), DND access check/request, notifications/channel-enabled checks exposed to JS
- 11.10 Android native III: foreground service (`specialUse`) started by exact alarms (study hours, wind-down, focus, remaining-budget alarm for the limit), checks the foreground app at the interval, pauses while the screen is off, updates one ongoing notification with Start focus / 5 more / break; rules snapshot handed to native like the widget snapshot; button taps via the pending-actions queue
- 11.11 Integrity monitor: incidents (notifications or the channel off, Usage access removed, DND access revoked, extension missing or without incognito) detected on open/resume and by the service, +7 days per new incident, persistent Today banner until fixed; tests
- 11.12 Extension I: MV3 scaffold + Vite build (`npm run extension:build`), domain-time tracker (active tab, focused window, idle, incognito), daily totals in `chrome.storage`; tests for the tracker
- 11.13 Extension II: on-page reminder bar (shadow DOM, never blocks) + browser notification at the interval with the same buttons, using the shared trigger engine; tests
- 11.14 Extension III: bridge with the ASCEND web app (totals in; rules, lock, focus state, free time out; heartbeat + incognito status for integrity), `extension/README.md` (install unpacked in Chrome/Edge, Allow in Incognito)
- 11.15 Settings → Digital discipline: parts on/off, setup guides (Usage access incl. Nothing OS, DND explanation, extension), rules + lock editor showing pending changes with their dates
- 11.16 Screen time screen (today / this week, top apps/sites, Entertainment vs Work/Study), observe-week card and suggestion review, planned free time list/editor
- 11.17 "Digital discipline" daily quest (auto, judged at day close) + weekly review section (Entertainment vs last week, breaks, free time, lock extensions); tests
- 11.18 Privacy + data: export/import, compaction (old `screen_days` → monthly totals), Delete everything keeps locks, Ask context never includes screen time, My data counts; tests
- 11.19 Phase 11 wrap-up: flag on, E2E, README, CHANGELOG, v0.11.0 (versionCode 11), real-device checklist (Nothing Phone (3a), Chrome on Windows)
