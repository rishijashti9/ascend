Read CLAUDE.md, then PROGRESS.md. Check git status.
Add a new Phase 12: "Redesign + switchable themes". Record this in DECISIONS.md. This phase changes ONLY how the app looks and moves — never the game rules, data, sync or engine. All existing tests must keep passing.

ORDER — ONE THEME AT A TIME, WITH MY PERMISSION
- Part 12A: build the theme system and apply the ELEVATE theme to the WHOLE app as the DEFAULT. Finish it completely (every screen, VFX, Android widgets/splash, quality pass), release it, give me a phone checklist, then STOP and ask my permission before starting the next theme.
- Part 12B: VOID — only after I say go. Then STOP and ask again.
- Part 12C: SOLAR — only after I say go. Then STOP and ask again.
- Part 12D: ION — only after I say go.
- Until a theme is built, it does not appear in the theme picker (no half-finished themes).

REFERENCE MOCKUPS
- Visual references are in docs/design/mockups/ (HTML/CSS mockup files). Read them to understand each theme's colours, fonts, shapes, shadows, spacing and animations. They are references, not code to paste: rebuild the look properly with the app's React components and design tokens. Numbers in them (Day 3, Level 4, etc.) are placeholder data — always show real data.
- Theme ↔ files: ELEVATE = ElevateToday / ElevateLevelUp; VOID = VoidToday / VoidLevelUp; SOLAR = SolarToday / SolarLevelUp; ION = IonToday / IonLevelUp. (Main / LevelUp / Focus / Profile = an earlier exploration — use only for screen ideas, e.g. the Focus ring and Profile layout.)

NAVIGATION & STRUCTURE (applies to every theme — build it in 12A)
- References: docs/design/mockups/E2Today, E2Quests, E2Focus, E2Growth, E2Me, E2Ask (.dc.html) — the ELEVATE versions of every main screen.
- Remove the "More" tab. New bottom bar: Today · Quests · [Focus — big centre button] · Growth · Me, with icons AND labels.
- Growth = one screen with tabs: Goals · Roadmap (Growth Compass) · Skills (and Jobs when enabled).
- Me = one screen with tabs: Stats & achievements · Body · Reviews; Settings opens from a gear button top-right. Screen time lives in Me (and on Today).
- Today becomes a dashboard: XP/level header, a "Today's quests" tile (progress + next quest), and live tiles that open their screens: Body (sleep, steps), Skill (current skill, hours this week), Roadmap (next step, readiness %), Screen time (today vs limit), plus a check-in/review tile only when one is due. Every main feature is at most one tap from Today.
- "Ask the System" becomes a floating round robot button (bottom-right, above the bar) on every main screen. It opens a bottom sheet that knows which screen you came from and shows suggested questions for that screen; you can also type. Privacy rules unchanged: on Body it answers general health questions and never sends personal health data. If Ask is off, the button opens Growth Compass answers instead.
- Keep every existing screen and feature reachable; update deep links, notifications and widget taps to the new locations.

THE THEMES (same features in every theme; only the look changes)
1. ELEVATE — dark mode elevation (DEFAULT, build first): pure black #000000 with faint corner light; big rounded bento tiles in lime #C8F03C, white #F2F2F2, yellow #FFE14D, dark grey #2A2A2A, violet #A35BFF; round ↗ buttons on tiles; white pill filter chips (All / Core / Body / Mind / Career on Today); floating pill bottom bar with a white active circle; extra-bold expanded headings and big numbers. Level-up: simple heading "You've reached Level N" with a short grey line, slowly morphing organic shapes (violet #A35BFF, blue #1E9BFF, red #FF3B2F), a white swoosh that draws itself, twinkling sparkles, a 2×2 colour reward grid (green #1FA35B, orange #FF7A1A, pink #F27BE6, blue #1E9BFF), white pill CONTINUE button with a black ↗ circle. Fonts: Archivo (expanded width, extra bold) + Inter. Design every other screen (Focus, Goals, Compass, Profile, Settings, etc.) in this same language: black ground, colour tiles, pills, ↗ circles, sparkles for celebrations.
2. VOID — dark glow: Void Black #0B0F14, Neon Cyan #3DF2E0, Pulse Violet #8A6CFF, Plasma Magenta #E445FF. Glassy layered panels, soft glow, XP shimmer, glowing level-up rings and rising sparks. Fonts: Unbounded + Inter.
3. SOLAR — bold neo-brutalism: Solar Lime #B6FF3B, Circuit Navy #0C1A2B, yellow #FFD93D, orange #FF7A45, lilac #C9BCFF, paper #F4F1E8. Thick navy outlines, hard offset shadows, chunky tiles that press down when ticked, star badges, slam/pop animations. Fonts: Archivo Black + Space Grotesk.
4. ION — soft & calm (light): surface #E4E9F0, Ion Blue #4FC3F7, magenta→orange gradient (#E445FF→#FF8A3D) for progress rings. Soft raised/pressed (neumorphic) surfaces; ticked items sink in; calm ring-fill and floating bubbles. Text dark enough for WCAG AA (e.g. #0369A1 for blue text). Font: Plus Jakarta Sans.

THEME SYSTEM (built in 12A, reused by later themes)
- One theme definition per theme: colour tokens (incl. stat colours STR/INT/WIL, success/warning/error, text levels), fonts, radii, borders, shadows/glow, surface style (tile / glass / brutal / soft), motion style and effect set. Components read tokens and a small set of variant switches — no screen hard-codes colours. Adding a theme later = a new definition + its effects, not rewriting screens.
- Settings → Appearance: theme picker with a live mini-preview of each BUILT theme; switching is instant, saved, synced across devices, and never touches user data. Default: ELEVATE. The old light/dark setting is replaced by the themes.
- Bundle fonts locally (no Google Fonts link) so themes work offline; load a theme's fonts only when it's used, if practical.
- Original "System companion" robot (simple SVG: rounded head, dark visor, two eyes, antenna) with a per-theme style; used in System messages, level-up/rank-up, empty states and onboarding; blinks/idles subtly.

VFX (per theme, each in its own style)
- Quest complete, min→full upgrade, Daily Clear, streak milestone, level-up (full-screen, skippable), rank-up (bigger, rare), achievement unlocked.
- Settings → Effects: Full / Light / Off. Respect system "reduce motion" (Off). Animate only transform/opacity where possible; keep 60 fps on my Nothing Phone (3a); pause animations when the app is hidden; no battery-heavy loops.
- Optional subtle sound + haptics on quest complete and level-up (off by default, toggle in Settings).

APPLY EVERYWHERE — EVERY FEATURE MUST BE REDESIGNED (for each theme)
- Before building, make a complete INVENTORY from the codebase of every route, screen, tab, sheet, dialog, card, banner, toast, empty / loading / offline / error state and notification-related screen. Put it in PROGRESS.md as a checklist ("Redesign inventory") — nothing may be missed. Each item is ticked only when it is fully redesigned in the current theme.
- The inventory must at least include:
  - Onboarding (all steps, templates, start today/tomorrow, sign-in on a new device).
  - Today: dashboard tiles, quest cards (full/min/numbers), wake-up "I'm up", low-energy mode, Recovery quest, Now line, at-risk marks, suggestion card, welcome-back, goal follow-up cards (behind schedule, 30-day check-in), screen-time card and lock banner, check-in/review prompts.
  - Quests: daily/weekly/side tabs, filters, create/edit habit and quest sheets (measure, target, minimum, core, schedule, skills, links), archive/restore.
  - Focus: setup, running timer, full-screen mode, face-down check, "Did you finish?", session history and charts.
  - Growth → Goals: dream, main quest and milestone pages, edit/pause/finish/archive, progress and forecasts; Goal Planner (analysis, interview, preview/approve, plan history, undo).
  - Growth → Roadmap (Growth Compass): career discovery quiz, careers list and detail, gap analysis, roadmaps, study guides, health check-in, health plans.
  - Growth → Skills: skill tree, skill detail/editor, evidence, 70/30 balance; Jobs (when enabled): list/board, application sheet, stats, follow-ups.
  - Me: stats, radar, heatmap, XP history, achievements, titles, level-up and rank-up moments; Body (logs, charts, photos, Health Connect); Reviews (daily check-in, weekly review, monthly/yearly summaries); Screen time (setup, observe week, limit card, lock info, app list); "What the System knows about you".
  - Ask the System: floating button and sheet, answers, fallback states.
  - Settings: every section — account and sync, appearance (themes), effects, notifications, exact timing, battery guide, quiet hours, wake-up, Health Connect, screen time, Ask, Auto-plan, My data (storage, sent-outside log, compaction, delete everything), export/import, rebuild progress, reset, version.
  - System screens: error screen, update prompt, offline/sync status, confirmations, toasts.
  - Android: home-screen widgets and splash.
- Desktop layout too (sidebar instead of bottom bar, wider grids).
- At the end of each theme: automatically check there are no leftover old styles or hard-coded colours (search the code), take a Playwright screenshot of EVERY route/tab in that theme at 360 px (key ones also at 768 and 1440), and list any item not redesigned. Don't finish the theme until the inventory is 100% ticked.

QUALITY (for each theme)
- WCAG AA contrast (automated contrast test per theme's tokens), tap targets ≥44 px, screen-reader labels unchanged.
- Visual check of key screens at 360, 768 and 1440 px (Playwright screenshots); fix overlaps and clipping.
- Never break existing user data; all existing unit and end-to-end tests pass.

PROCESS
First write the SPEC.md section and the Phase 12 task list in PLAN.md and PROGRESS.md (small tasks, section 0.1), grouped as 12A (theme engine + ELEVATE everywhere), 12B (VOID), 12C (SOLAR), 12D (ION). Then STOP and show me a short summary for approval. After I approve, build ALL of 12A without stopping between tasks. At the end of 12A, give me one short summary (what's new, bugs fixed, decisions made, phone checklist) and ASK my permission before 12B. Same for each following theme.
