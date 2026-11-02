# Changelog

All notable changes to ASCEND. Versions follow [semantic versioning](https://semver.org).

## [Unreleased]

## [0.6.0] — 2026-11-03 — Phase 6: Notifications

### Added

- Wake-up check-in: at your wake time, “Day N. Are you up?” with an “I’m up” button — the moment you tap is what counts, even if the app opens later.
- Morning briefing (how many quests today, where to start), a core quest reminder at 18:00 only while core quests are still open, and an evening wind-down that opens the 1-minute check-in. Each has its own switch; the wind-down time can be changed.
- Quiet hours (default 22:00–04:45): nothing arrives inside them except the wake-up check-in; Settings points out a reminder that falls inside them.
- If ASCEND isn't opened for a week, reminders stop by themselves — except one gentle note.
- Android: reminders are scheduled a week ahead on the phone and work offline (re-planned after every change and every new day). Web: reminders show as a banner while ASCEND is open, with optional browser notifications — Settings says plainly what each can do. “Send a test” in Settings.
- End-to-end test: notifications on the web (settings, test banner, a reminder coming due).

## [0.5.0] — 2026-11-03 — Phase 5: Reviews & progress

### Added

- Review (in More): a 1-minute daily check-in (energy, mood, one win, one lesson), with a reminder on Today in the evening.
- Weekly review: how the week went, two questions, and next week's quests to keep, drop or rename before the week starts (saved straight into next week, with Undo). Today reminds you on the week's last day.
- Monthly and yearly summaries made from your data (active days, Daily Clears, XP and levels, focus hours, quests and milestones, best streak, check-in averages), browsable back to your first month, with an optional reflection.
- Profile (in More): level, rank and what the next rank needs, lifetime numbers, a stats triangle, XP per week, and a GitHub-style calendar of active days for every year.
- 46 quiet achievements tied to real behaviour (First Light, Iron Habit, Centurion, …) with a small note when one unlocks; any unlocked one can be worn as your title on Profile and Today.
- Level-up and rank-up moments: a short full-screen card, skippable with one tap or Esc, still with reduced motion, never replayed.
- Difficulty suggestions on Today: after 3 days under 50%, aim for minimums and make the hardest quests a bit smaller; after 7 days at 100%, raise one a little; after 4 low-energy days in a row, a gentle check-in. One tap applies (with Undo), "Not now" hides it for a while.
- End-to-end test: a level up shows its moment once.

### Changed

- Steps and sleep are one number per day: entering them on the Walk / Sleep quest updates the Body log and its charts, and entering them in Body updates the quests. Undo / clearing works in both places.
- A weekly quest finished after the weekly review removes its untouched copy from next week (with Undo).

## [0.4.0] — 2026-11-02 — Phase 4: Focus & Body

### Added

- Focus: pick a minutes quest (its minutes go into the quest — never double XP) or a stat (1 XP per focused minute), 25/5 or 50/10, then a minimal full-screen timer that keeps the screen on. Ending early still counts the minutes for a linked quest. A face-down honesty check at the end, and "Did you finish?" if the app was closed past the end. Session history with this week's minutes per stat and minutes per day this month. "Start focus" on Today; Focus is in the bottom bar.
- Body: daily weight, waist, sleep, steps and workout notes (today's steps and sleep also fill in the Walk and Sleep quests), the last 14 days in a table, and trend charts (weight and waist with your milestone target, sleep and steps against your quest goals) — each with a table view.
- Body photos: one per day, kept only on this device, shrunk before saving. "Export with photos" saves a .zip that restores them (and all data) on a new device.

### Fixed

- Photos are restored before the data import, so leaving the screen right after importing can't cut the photo restore short.

## [0.3.0] — 2026-11-02 — Phase 3: Goals + Goal Planner

### Added

- Goals: dreams → main quests → milestones, with progress calculated from real data (metric, count or weekly quests), deadlines, "why this matters to me", and pause / finish / archive / restore (nothing is deleted by accident).
- Weekly and side quests: Quests tabs Daily · Weekly · Main · Side, and a "This week" section on Today. Their XP counts on the day they're done.
- Goal Planner (rule-based): plan templates for exam prep, university application (APS/Germany), learning a skill, portfolio projects, job search, fitness and habit change. A short tap-first interview (answers remembered), a plan sized to your time and deadline, and a preview where every item can be unticked or edited before approving.
- Plans also follow goal changes: pausing, resuming, finishing or archiving a goal proposes what to do with its linked quests; a finished milestone unlocks the next one (automatically with Auto-plan on).
- Plan history with exact Undo for every applied plan.
- Weekly plan: each new week, unfinished weekly quests are carried over and the next steps are added (with Undo).
- Follow-ups: deadline-risk warnings with one-tap options and a 30-day "Is this goal still important?" check-in. Today lists goals that need a look, including the ones from onboarding that still need a plan.
- End-to-end test: goal → planner → approve → change → approve → undo.

### Fixed

- End-to-end tests matched the "Today" heading loosely, so after 6 PM they could race ahead of the onboarding save.

## [0.2.0] — 2026-11-02 — Phase 2: Core loop

### Added

- Game engine: XP (streak bonus, soft cap, Daily Clear, top-ups, same-day corrections), completions, active/neutral days, low-energy mode, streaks with shields and Recovery-quest repair, per-quest streaks.
- Day rollover on open, resume and at the day-start hour; Recovery quest after a missed day.
- Progress (level, stats, rank, streaks) always computed from stored data, with a consistency check at every start.
- Onboarding "Awakening": five pre-filled steps — name, wake-up time, daily quests (editable, up to 3 core), Dream and Main Quests, theme, and "start today or tomorrow" when it's late.
- Today screen: level, XP bar, rank, streak, shields and the three stats; quest cards with Full/Minimum taps, quick minute buttons, step and sleep totals, the "I'm up" wake-up check-in, and Undo.
- Today screen: low-energy mode, a System message (Day N, welcome back, streak, Daily Clear), the Recovery quest card, and a small check + floating XP when a quest is completed.
- Quests screen: create, edit (including which days), reorder, pause, archive, restore and delete daily quests; choose up to 3 core quests; see each quest's streak.
- Settings: theme, day-start hour, week start, wake-up time / window / late cutoff, core quests overview, Rebuild progress, and Reset all data (with confirmation).
- Export / import: back up everything to a JSON file (download in the browser, share sheet on Android), restore on a new device from onboarding, or import with Replace / Merge (a safety backup is saved first). Weekly backup reminder in the browser; "Export my data" on the error screen.
- Developer tools (dev builds only): generate 30 days, 1 year or 2 years of realistic test data.
- End-to-end tests: onboarding, completing a quest, a low-energy day, and export → wipe → import.

### Fixed

- On a low-energy day, finishing the core minimums now shows its own kind System message (it was hidden behind the Daily Clear message).

## [0.1.0] — 2026-11-02 — Phase 1: Foundation

### Added

- Project setup: React + TypeScript (strict) + Vite, ESLint, Prettier, Vitest.
- Planning documents: SPEC, PLAN, DECISIONS, PROGRESS.
- Design tokens for light and dark themes (WCAG AA checked), Tailwind CSS, bundled Inter and Space Grotesk fonts, theme follows the system.
- App shell: bottom tab bar on phones, sidebar on laptops, More and Settings pages, friendly error screen with a local error log.
- Local database (IndexedDB) with the complete schema for all phases, default settings, and a request for persistent storage.
- Single action pipeline: every change is validated, written in one transaction, and announced as an event; XP awards can never be counted twice.
- Installable app (PWA) that works fully offline, original app icon, and a calm "Update ready" prompt.
- Developer tools (dev builds only): time travel, timezone switch, reset.
- Hosted at https://ascend-vert-mu.vercel.app (auto-deploys from GitHub).
- End-to-end smoke tests (Playwright) for phone and laptop sizes, runnable against the live site.
- Android app shell (Capacitor) with launcher icons and splash screen; README guide for building and installing on an Android phone from Windows.
