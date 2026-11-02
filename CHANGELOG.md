# Changelog

All notable changes to ASCEND. Versions follow [semantic versioning](https://semver.org).

## [Unreleased]

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
