# DECISIONS.md

Every answer Rishi gave and every decision made. Newest at the bottom of each section. If this file and SPEC.md differ, **this file wins**.

## From SPEC.md section 14 (already decided)

- Devices: Android phone + Windows laptop. README commands must work in PowerShell.
- App name: **ASCEND**. Start offline; sync in Phase 7. AI coach = Claude (Anthropic API) via `AIProvider`.
- Body photos: yes, stored on this device only, never synced.
- Wake time 5:00 AM, wake-up window 20 min. Day-start hour **3:00 AM**. Week starts Monday. Timezone from device (Asia/Kolkata now).
- Starter daily quests (all every day, incl. weekends):

| Quest                            | Stat | Difficulty | Measure               | Full             | Minimum                       | Core |
| -------------------------------- | ---- | ---------- | --------------------- | ---------------- | ----------------------------- | ---- |
| Wake up on time                  | WIL  | Normal     | check (wake check-in) | "I'm up" by 5:20 | late check-in                 | yes  |
| AI & Robotics study (phone-free) | INT  | Hard       | minutes               | 150              | 30                            | yes  |
| Workout                          | STR  | Normal     | check                 | 30 min workout   | 10 push-ups                   | yes  |
| Game dev study (phone-free)      | INT  | Normal     | minutes               | 60               | 15                            |      |
| Walk                             | STR  | Easy       | steps                 | 8,000            | 3,000                         |      |
| Sleep                            | STR  | Normal     | sleep_hours           | 7.5              | 6.5                           |      |
| Journal                          | WIL  | Easy       | check                 | 10 min writing   | 3 lines (one win, one lesson) |      |
| Meditate                         | WIL  | Easy       | minutes               | 10               | 2                             |      |

- Career learning 3–4 h/day, 70% AI & Robotics / 30% game dev. Phone-free deep work is merged into the study quests.
- No job-application quest for now (job search paused; Jobs screen hidden until switched on).
- Evening wind-down reminder around 9:00 PM.
- Dream: Become a robotics engineer at a top company or research lab (humanoids / advanced robots).
- Main Quests (all under that Dream, INT): Core robotics skills; Robotics portfolio; Game dev foundations; MS in AI/Robotics in Germany (APS route — planner asks intake, universities, IELTS/GRE, APS status).

## Answers to pre-build questions (2026-11-02)

1. **Wake-up timing**
   - a. A tap _before_ wake time counts as on time (`done_full`).
   - b. **Late cutoff is 7:00 AM.** Tap between wake time + window (5:20) and 7:00 → `done_late`. After 7:00 the "I'm up" button disappears and the wake-up quest is **missed** for that day. _(Rishi changed this from the suggested noon.)_ The cutoff is a setting (`wake_late_cutoff`, default 07:00).
2. **Shields/repair and streak count**
   - a. A shielded or repaired day **keeps** the streak but does **not** increase it.
   - b. Shielded/repaired days do **not** count toward the 7 consecutive active days that earn a shield (the 7-day counter pauses on them, it doesn't reset).
3. **Long absences**: shields cover missed days in order. The Recovery quest appears on the return day and repairs a day **only if exactly one unprotected missed day** stands between today and the streak; otherwise it gives Easy XP and a fresh start (no repair). "Max one repair per 7 days" = **rolling 7 days**.
4. **Bonuses**
   - a. Daily Clear = flat +20, no streak bonus, does not count toward the 300 soft-cap threshold.
   - b. Stat XP for an event = the **same final (post-bonus, post-cap, rounded) amount** credited to the player.
5. **Editing a habit mid-day**: today's instance takes the new target/difficulty only if still `pending`; if already completed today, it keeps its snapshot and the change applies from tomorrow.
6. **GitHub**: Rishi has a GitHub account. `gh` CLI is installed (v2.97.0). Claude creates the private repo **`ascend`** with `gh` after Rishi runs `gh auth login`. Branch `main`, one commit + push per task.
7. **Hosting**: **Vercel**, connected to the GitHub repo (auto-deploy on push). Set up at the end of Phase 1.
8. **Sign-in (Phase 7)**: Supabase **email magic link + Google** sign-in. No passwords.
9. **Developer tools**: exist only in `npm run dev`; fully stripped from production builds and the APK.
10. **Day 1 / late start**: if onboarding is after 6 PM and Rishi picks "start tomorrow", Day 1 = tomorrow and tonight is neutral. "Start today" → Day 1 = today, still neutral.

## Engineering decisions (Claude — change any of these if you disagree)

- **XP curve**: XP to reach level n from n−1 = `round(80 * n^1.15)` (spec started at `50 * n^1.4`). Reason: XP grows roughly linearly with time, and with exponent 1.4 year-5 level was only ~2× year-1 (≈24 → 48). The spec's targets (≈27 → ≈58) need a flatter curve. See PLAN.md "Balance".
- **Rank thresholds**: E start · D L5 + 14 active days · C L15 + 90 · B L25 + 250 · A L40 + 600 · S L55 + 1150. (S lands late year 4 / year 5 in the simulation.)
- **Dates**: our own small module on top of the built-in `Intl` API (no date library). All "now" goes through one clock module, so dev tools can shift time.
- **Libraries**: React 19, TypeScript strict, Vite, Tailwind CSS v4 (reads the CSS-variable tokens), React Router, Zustand, Dexie (IndexedDB), Zod (validating imports and AI output), Recharts, Lucide icons, vite-plugin-pwa, Capacitor; Vitest + fake-indexeddb + Playwright for tests. Fonts from `@fontsource` packages so they're bundled into the build (no Google Fonts link).
- **Extra tables beyond spec section 10**: `meta` (key/value: last rollover, cache version), `plan_proposals` (planner output waiting for approval), `photos` (image blobs, separate from `body_logs`, never synced) (the crash log lives in localStorage — see the task 1.3 decision). Every record also gets `hlc` (hybrid logical clock string) from day one, so Phase 7 sync needs no migration.
- **Dev test-data generator** moves from Phase 1 to Phase 2 (task 2.14): realistic data needs the quest-completion actions that Phase 2 builds. Phase 1 dev tools = date travel, jump N days, reset.
- **TypeScript 6.0, not 7.0** (task 1.1): typescript-eslint doesn't support TypeScript 7 yet (needs < 6.1). Upgrade when it does.
- **Known dev-only audit warning** (task 1.1): `npm audit` reports a moderate `minimatch` issue inside ESLint's dependencies. It only affects the lint tool on this laptop, never the app. The suggested "fix" downgrades typescript-eslint, so it's left alone until ESLint updates.
- **Colour tokens** (task 1.2): light theme uses darker text variants so every text colour passes AA (4.5:1) on bg, surface and surface-2: accent #396abf, STR #9e5a31, INT #1c7784, WIL #745cbf, success #2a785c, warning #846826, error #bc443d. Light primary buttons are #396abf with white text (white on #4C8DFF is only 3.2:1); dark primary buttons are #4C8DFF with near-black text. Dark error text is #e75d56 (slightly lighter than #E5534B for AA on surface-2). Spec base colours are still used for fills (XP bars, stat chips). Tailwind's own colour palette is removed so only tokens can be used.
- **Tests have their own tsconfig** (`tsconfig.test.json`) so Node types never leak into app code.
- **Navigation follows feature flags** (task 1.3): the bottom bar shows only built features plus More, growing to exactly 5 (Today · Quests · Focus · Goals · More) as phases finish. Hidden routes redirect to Today. Sidebar appears at ≥1024px.
- **Crash log in localStorage, not IndexedDB** (task 1.3): it must work even when the database is what failed. Newest 100 entries. The planned `error_log` table is dropped.
- **Error screen buttons** (task 1.3): "Reload" and "Copy error details". "Export my data" is added in task 2.13 when export exists (no dead buttons).
- **DST gaps** (task 1.4): a wall time that doesn't exist (e.g. 02:30 on a spring-forward night) is shifted forward by the gap (→ 03:30), like JavaScript Temporal's "compatible" mode. Only matters if Rishi lives somewhere with DST (e.g. Germany).
- **Schema details** (task 1.5): quest instances snapshot title, stat, difficulty, measure, target/min, full/min wording, **core flag** and auto source — so editing a habit (or changing which habits are core) never rewrites past days. Progress entries also store `day`. Milestone status adds `upcoming` (planned but not started). Timestamps are ISO-8601 UTC strings. `settings` and `profile` are singleton rows (`id` = 'settings' / 'profile'); `days` rows use the day string as id. Default quiet hours 22:00–04:45, AI budget $5/month (both editable later).
- **HLC from day one** (task 1.5): every write gets a hybrid logical clock string (`ms-counter-deviceId`), so Phase 7 sync needs no migration.
