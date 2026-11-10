# ASCEND — product clarity audit and redesign proposal

Date: 2026-11-11 · App 0.12.0 (`main` @ `ee40044`) · **Review document — no source code changed.**

Method: read the spec, decisions and code; walked every screen of the production build as a
brand-new user at 360 px (17 screens, full-page screenshots; 768/1440 px of the key screens
also captured); traced the data model and every progress calculation in code. No screenshots
were attached to the request, so this audit uses my own captures of the current build.

---

## A. Existing architecture (summary)

React 19 + TypeScript PWA, Android via Capacitor, local-first IndexedDB (Dexie), optional
Supabase sync, optional AI ("Ask the System") through an Edge Function. Every change goes through
one validated pipeline (`recordAction`); derived values (level, rank, streaks, stat levels,
skill levels, goal progress) are recomputed from stored records. Full technical detail:
`docs/audit/phase-1-discovery.md` and `FINAL-REPORT.md`.

**The data model already implements the intended chain — the problem is how the UI shows it.**

```
Dream ──< Main quest ──< Milestone          (Growth → Goals; progress: engine/goals.ts)
               │              │
               │   Goal Planner turns a main quest into milestones + weekly quests
               ▼              ▼
     Daily quest (habit) / Weekly quest / Side quest   (linked_goal, skill_ids)
               │
       done / progress entries ◄── Focus session (linked to a quest or a stat, tagged skills)
               │
   XP events (append-only) ─► level, rank, STR/INT/WIL, streaks, achievements
               │
   Skill evidence (focus minutes, linked quests, projects) ─► skill level 0–5
               │
   Growth Compass (career → skill graph matched to YOUR skill tree; gap → planner proposal)
   Adaptive System (reads all of the above; suggests, never changes without approval)
```

Single sources of truth (verified in code): milestone / main-quest / dream progress —
`engine/goals.ts` only; skill levels — the skill engine, reused by the Compass gap (`levelOf`);
XP — `xp_events`; steps and sleep — one value per day shared by the Walk/Sleep quests and Body.
**No conflicting progress calculations were found.** No data-model change is needed for this
redesign.

## B. Product clarity audit — screen by screen

| Screen                              | Purpose (as it should be)                         | What a new user sees today                                                                                                                                                                                                                                                                                                              | Verdict                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**                           | "What do I do now?"                               | ~3.4 phone screens: header with Day, Lv, Rank, streak, XP bar, 3 stat bars → System message → **"Now: Journal"** → **"Today's quests 1/8 · Next: Wake up on time"** tile → Body / Skills / Roadmap shortcut tiles → "The System suggests" (3 rows "needs a plan") → the full daily list with filters, Start focus, inputs on every card | Too much, and **two different "next" answers** (one not even doable — the wake-up window had closed). The summary tile repeats the list below it. Shortcut tiles duplicate the nav bar.   |
| **Quests**                          | "What have I committed to?" (define, edit, pause) | Daily / Weekly / **Main** / Side tabs; Daily = editable definitions with Core stars                                                                                                                                                                                                                                                     | Good management view, but **Main** is a second list of main quests ("details live on the Goals screen" — code comment).                                                                   |
| **Focus**                           | Deep work linked to a quest                       | Timer, "What is it for?", length, history                                                                                                                                                                                                                                                                                               | Clear. Best screen. Missing: what the session counts toward (goal/skill).                                                                                                                 |
| **Growth → Goals**                  | "Where am I going?"                               | Dream card (lime) → main quests each showing **0% twice** and "0 of 0 milestones"                                                                                                                                                                                                                                                       | Hierarchy is right; the main next step ("plan this main quest") isn't here — it's on Today as "needs a plan".                                                                             |
| **Growth → Roadmap**                | —                                                 | **Growth Compass**: a 20-question career quiz always expanded, then generic "Roadmaps and guides" (AI & ML, ROS 2, C++…), ~7,000 px tall                                                                                                                                                                                                | **Name collision**: "Roadmap" here is generic guidance, not the plan for _your_ goals (that's the Goal Planner). Same skill names as the Skills tab → users can't tell which is "theirs". |
| **Growth → Skills**                 | "What am I getting better at?"                    | Study balance, skill tree with 0–5 levels, how levels are earned (at the bottom)                                                                                                                                                                                                                                                        | Useful; **overflows horizontally at 360 px**. How a skill grows is explained last.                                                                                                        |
| **Growth → Jobs**                   | Optional tracker                                  | Off by default                                                                                                                                                                                                                                                                                                                          | Fine.                                                                                                                                                                                     |
| **Me → Stats**                      | "How am I progressing?"                           | Large Screen time + "What the System knows" tiles, then tabs, Level card (again — also on Today), stat triangle **and** stat tiles, XP per week, achievements, heatmap                                                                                                                                                                  | Secondary features shown as the biggest elements; level shown in 3 places; **overflows at 360 px** (heatmap).                                                                             |
| **Me → Body**                       | Body logs, photos                                 | Form + photos                                                                                                                                                                                                                                                                                                                           | Clear; steps/sleep can also be typed on Today (same value — fine, but not explained on Today).                                                                                            |
| **Me → Reviews**                    | Reflection                                        | Daily/Weekly/Monthly/Yearly check-ins                                                                                                                                                                                                                                                                                                   | Clear; not reachable from Today in the evening when it's relevant.                                                                                                                        |
| **Settings**                        | Preferences                                       | One flat page ~5,200 px: Account, Appearance, Day & week, Wake-up, Core quests, Notifications, Goal Planner, Backup, Data, About…                                                                                                                                                                                                       | Hard to scan; no grouping.                                                                                                                                                                |
| **Ask the System**                  | Career/health questions                           | Floating robot button on every screen                                                                                                                                                                                                                                                                                                   | The floating button **covers content** on Today, Quests, Roadmap and Skills (text and buttons under it).                                                                                  |
| **My data / What the System knows** | Transparency                                      | Clear explanations                                                                                                                                                                                                                                                                                                                      | Good; reached from Me tiles that are larger than their importance.                                                                                                                        |

Terminology found in the UI:

| Concept                   | Words used                                                    | Problem                                                                                                           |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Top of the goal hierarchy | Dream, goal, "Goals" tab                                      | The tab is "Goals" but the entities are Dream → Main quest → Milestone; "goal" is also used loosely ("this goal") |
| The three life areas      | STR / INT / WIL **and** Body / Mind / Career (Today filters)  | Two vocabularies for the same three things                                                                        |
| Plans                     | Roadmap (Compass guides), plan (Goal Planner), "needs a plan" | Same word family, two different features                                                                          |
| Recurring daily work      | Daily quest (UI), habit (code only)                           | Fine                                                                                                              |

## C. Prioritised problems list

No Critical issues (nothing loses data or misleads about progress totals).

| #   | Sev.     | Problem                                                                                                                                                                                                                             | Evidence                                                                                               |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| P1  | **High** | **Conflicting and wrong "next action"**: Today shows two different nexts; the tile's pick ignores whether the quest is still doable (e.g. a closed wake-up window) and shows "core done" on Day 1 when there are no core quests yet | `TodayTiles.tsx` `QuestsTile` (first open core quest in list order) vs `WhatNow.tsx` (Adaptive System) |
| P2  | **High** | **Horizontal overflow at 360 px** on Skills and Stats (page wider than the screen)                                                                                                                                                  | screenshots 1097 px and 966 px wide vs 945 px                                                          |
| P3  | **High** | **Today has no single primary action** and repeats itself (summary tile + full list, 3 nav tiles, suggestion list) — 3.4 screens long                                                                                               | Today screenshot                                                                                       |
| P4  | **High** | **"Why does this task matter?" is not answered for daily quests**: cards show the stat, not the main quest or skill they serve (only weekly/side show a goal line)                                                                  | `QuestCard.tsx:122`                                                                                    |
| P5  | **High** | **Goal → execution chain is invisible**: planning a main quest is prompted on Today, not on the goal; "Roadmap" names generic guidance, not your plan                                                                               | Goals + Roadmap screenshots                                                                            |
| P6  | Medium   | Floating Ask button covers content and controls                                                                                                                                                                                     | Today, Quests, Roadmap, Skills screenshots                                                             |
| P7  | Medium   | Duplicate **Main** tab in Quests                                                                                                                                                                                                    | `QuestsPage.tsx:20`                                                                                    |
| P8  | Medium   | Two vocabularies for the life areas (STR/INT/WIL vs Body/Mind/Career)                                                                                                                                                               | Today filters vs stats                                                                                 |
| P9  | Medium   | Compass career quiz always expanded (20 questions) even when a target career is set; page ~9 screens                                                                                                                                | Roadmap screenshot                                                                                     |
| P10 | Medium   | Settings is one flat ~6.5-screen page                                                                                                                                                                                               | Settings screenshot                                                                                    |
| P11 | Medium   | Level / rank / XP shown in three places (Today header, Me card, sidebar on desktop); stats shown twice on Me (triangle + tiles)                                                                                                     | Today, Me                                                                                              |
| P12 | Medium   | Secondary features (Screen time, What the System knows) are the largest elements on Me                                                                                                                                              | Me screenshot                                                                                          |
| P13 | Low      | Main quests show their % twice; "0 of 0 milestones" doesn't say what to do                                                                                                                                                          | Goals screenshot                                                                                       |
| P14 | Low      | Wake-up card after its window just says "closed" — no next step (late check-in time, or "tomorrow at 5:00")                                                                                                                         | Today screenshot                                                                                       |
| P15 | Low      | Evening review isn't surfaced on Today when it's relevant                                                                                                                                                                           | Today/Reviews                                                                                          |

## D. Proposed information architecture

Each module answers one of the five questions:

| Question                                         | Module     | Owns                                                                                                    | Does NOT own                                       |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| What should I do next? / Where am I today?       | **Today**  | today's quests, the one next action, one System card                                                    | navigation shortcuts, definitions, long-term stats |
| What have I committed to?                        | **Quests** | creating/editing/pausing daily, weekly and side quests; core quests                                     | main quests (live in Growth)                       |
| Doing the work                                   | **Focus**  | sessions, timer, what a session counts toward                                                           | —                                                  |
| What am I trying to achieve? Why does it matter? | **Growth** | Dreams → Main quests → Milestones → their plan; Skills; Compass (explore careers/health guidance); Jobs | daily execution                                    |
| How am I progressing?                            | **Me**     | level, rank, stats, achievements, history, body, reviews; settings behind the gear                      | —                                                  |

Source of truth for each displayed number: unchanged (section A). The redesign only changes
where and how things are shown.

**Glossary (one word per concept, used everywhere):** Dream → Main quest → Milestone →
Weekly quest; Daily quest (some are **Core**); Side quest; Recovery quest; Skill (level 0–5);
Focus session; **Strength (STR) · Intellect (INT) · Willpower (WIL)** — the Today filters use
these names; "plan" = the Goal Planner only; the Compass is called **Compass**, not "Roadmap".

## E. Proposed navigation

Keep the five-tab bar (it's sound): **Today · Quests · [Focus] · Growth · Me**.

- Quests tabs: **Daily · Weekly · Side** (Main removed; a short "Main quests live in Growth →"
  link where the tab was).
- Growth tabs: **Goals · Skills · Compass** (+ Jobs when on). "Roadmap" → "Compass".
- Me: header (name, level, rank) → tabs **Progress · Body · Reviews**; Screen time, What the
  System knows, My data and Settings as a compact list of rows, not big tiles.
- Ask: out of the floating position — a robot button in the page header area (Today, Growth)
  and the "Ask" entry in the System card; nothing floats over content.
- Old addresses keep working (`/growth/roadmap` redirects to `/growth/compass`, like the
  existing `MOVED` table).

## F. Screen-by-screen redesign specifications

**Today** (order, top to bottom)

1. Compact header: "Day N", weekday · name; one row of pills: Lv · Rank · streak; thin XP bar.
   (Stat bars move to Me.)
2. **One "Next" card** — the single next action from the Adaptive System (`WhatNow`), with its
   why ("core · 30 min left · serves _Core robotics skills_") and one button (Start focus /
   Done / Log). Only actionable quests qualify. Replaces both "Now:" and the tile's "Next:".
3. **One System card** (message _or_ suggestion, never a list): e.g. "Core robotics skills has
   no plan yet — Plan it" (opens the goal), or the evening "Check in (1 min)".
4. **Today's quests**: Core first, then the rest; filters STR · INT · WIL; each card gets a one-line
   "for: _Main quest_ / _Skill_" when linked; done quests collapse into "3 done".
5. Remove: the "Today's quests" summary tile, the Body/Skills/Roadmap shortcut tiles.
   Result target: the next action visible without scrolling; ≤ ~2 screens.

**Quests** — Daily/Weekly/Side; each definition shows its link ("for: …") and lets you set it
in the edit form (already supported in data). Empty states say what to do ("Add your first
weekly quest, or plan a main quest in Growth to get some").

**Focus** — unchanged layout; the selected quest shows "counts toward: _Main quest_ · _Skill_".

**Growth → Goals** — each main quest card: one progress number, milestone count, and its
state as the primary button: **Plan it** (no milestones) / **Next milestone: …** / **Done**.
The Planner opens from here (it already exists). Empty state: "Add a dream — the System helps
you break it down."

**Growth → Skills** — fix overflow; "How skills grow" moves to the top as one line with a
"how?" toggle; each skill row shows what feeds it (n quests linked, focus hours).

**Growth → Compass** — if a target career is chosen: show it with its gap first ("4 skills to
go · Turn into a plan"); the discovery quiz collapses to "Retake career discovery". Guides
stay below. Health tab unchanged.

**Me** — Progress tab: Level card (only place with the full detail), stat triangle (drop the
duplicate tiles, keep the table toggle), XP per week, achievements, heatmap (fix overflow).
Rows for Screen time / What the System knows / My data / Settings.

**Settings** — group into sections that collapse (Account & sync · Appearance · Day & reminders
· Quests & planning · Data & privacy · About), opened from Me; each section keeps its current
controls and wording.

**All screens** — consistent empty, loading and error states (one component each); no floating
element covers content; every page fits 360 px without horizontal scroll.

## G. Technical implementation plan (small phases, each tested and approved)

| Phase                                | Changes                                                                                                                           | Main files                                                   | Risk                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------- |
| UX-1 Layout bugs (P2, P6)            | Fix overflow on Skills/Stats; move Ask out of the floating position; add an e2e check that no screen scrolls sideways at 360 px   | `SkillTree`, `Heatmap`, `Layout`, `AskButton`, `e2e/screens` | Low                       |
| UX-2 One next action (P1, P14)       | Today's tile uses the same `nextAction` as `WhatNow`; only actionable quests; fix "core done" copy; wake-up card says what's next | `TodayTiles`, `WhatNow`, `core/adaptive/today`               | Low–medium                |
| UX-3 Today restructure (P3, P4, P15) | New order; remove summary + shortcut tiles; "for: …" line on cards; evening check-in card                                         | `TodayPage`, `QuestCard`, `today/*`                          | Medium (most-used screen) |
| UX-4 Goals → execution (P5, P13)     | Plan-state button on main quest cards; Planner entry from the goal; single %                                                      | `goals/*`, `planner/*`                                       | Medium                    |
| UX-5 Navigation & terms (P7, P8, P9) | Remove Quests→Main (link instead); Roadmap→Compass with redirect; STR/INT/WIL filters; Compass quiz collapse                      | `QuestsPage`, `navigation.ts`, `routes`, `compass/*`         | Low                       |
| UX-6 Me & Settings (P10–P12)         | Progress tab consolidation; rows instead of tiles; grouped Settings                                                               | `me/*`, `profile/*`, `settings/*`                            | Low–medium                |
| UX-7 States & polish                 | Shared empty/loading/error components; copy pass with the glossary                                                                | `ui/*`                                                       | Low                       |

No new dependencies. Each phase: before/after screenshots at 360/768/1440, tests, report, your OK.

## H. Database and migration impact

**None.** Every change above is presentation: no new tables, no schema version, no migration,
no server change. Links ("for: …") use fields that already exist (`linked_goal_*`, `skill_ids`,
milestone/main-quest ids). Old routes keep working through redirects. Existing data, backups
and sync are untouched.

## I. Regression testing plan

1. Before any change: record the baseline — full suite (`npm run check`: 896 tests), e2e (42),
   perf (13 budgets), screenshots of every screen at 360/768/1440.
2. Per phase: update/add RTL tests for changed screens; e2e for the user journeys touched;
   axe on every screen (existing); the new **no-horizontal-scroll** check on every screen;
   compare screenshots with the baseline.
3. Journeys that must keep passing (all exist as e2e today): onboarding; complete a quest with
   XP; low-energy day; level up; focus linked to a quest (no double XP); goal → planner →
   approve → undo; export → wipe → import; photos; offline; account; Ask fallback.
4. New tests: Today shows exactly one next action and it is actionable; "for: …" lines match the
   data; Main quests reachable only via Growth (Quests link works); `/growth/roadmap` redirects.
5. CI must be green before each deploy; production checks after (existing live checks).

## Not verified here / for you

- **Features audit (section 6 of the request):** XP, ranks, STR/INT/WIL, streaks, shields,
  rollover, focus persistence, notifications/quiet hours, sync, Ask fallbacks and settings
  persistence are covered by the existing 896 unit/integration and 42 e2e tests (all passing),
  the 10-year performance test and the simulation; I did not find a case where the UI misreports
  stored data, except the "next" tile (P1) and the "core done" copy. A lived-in account (weeks of
  data) wasn't walked visually — I'd generate one with the dev tools at the start of UX-2.
- Decisions for you: approve the IA (D/E) and which phases to do; keep or drop the Jobs tab;
  whether stat bars may leave Today (they stay on Me).
