# Changelog

All notable changes to ASCEND. Versions follow [semantic versioning](https://semver.org).

## [Unreleased]

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
