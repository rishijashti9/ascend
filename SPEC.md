# Build "ASCEND" — a personal leveling system for real life

> Save this file as `SPEC.md` in an empty project folder, open Claude Code there and say: "Read SPEC.md and follow it exactly." 

---

## 0. Your role and how to work

You are a senior full-stack engineer and product designer. You are building an app that I will use **every day for many years**, so reliability, data safety and calm design matter more than flashy features.

Work like this:

1. **Before writing any code**, read this whole document, then ask me every question you need answered (batch them, max ~10). Do not guess on things that are hard to change later (data model, sync, auth).
2. Write a short **PLAN.md**: architecture, folder structure, data model, and the build phases from section 12 split into small tasks (0.1). Create `PROGRESS.md` from it. Wait for my "go".
3. Build **one phase at a time**, and each phase in **small tasks** (see 0.1). At the end of each phase: run the app, run the tests, fix every error and warning, and tell me in plain words what I can now do and how to try it.
4. Never leave placeholders, `TODO`s, fake data, or half-working buttons in a finished phase. Features from later phases stay **hidden** (no dead tabs, buttons or locked achievements) until their phase is built — use a simple feature-flag file. If something can't be done, say so clearly.
5. If you find a contradiction or gap in this spec while building, **stop and ask me** instead of guessing. Section 4.8 is the authority for all game rules.
6. Keep code simple and readable. Prefer fewer, well-chosen libraries. Explain any decision I might want to change.
7. Maintain a **README.md** (how to run, build, deploy, install on phone/laptop, back up data) and a **CHANGELOG.md**.
8. This build will take many sessions. Save this spec as `SPEC.md`, create a short `CLAUDE.md` that says "Read SPEC.md, PLAN.md, DECISIONS.md and PROGRESS.md before any work, and follow section 0.1", and record every answer I give you and every decision made in `DECISIONS.md`, so nothing is forgotten between sessions.
9. After Phase 2, **stop for one week** while I use the app daily, then ask me what felt wrong before starting Phase 3. Real use beats guessing.
10. Build a **developer-only tools panel** (never in my normal build): change the current date/time, jump forward N days, generate years of realistic test data, and reset. This is how day rollover, streaks, shields and weekly planning get tested properly.
11. If the Android SDK isn't available where you run, give me exact step-by-step instructions to build and install the APK on my own **Windows** laptop (Android Studio, USB debugging on my Android phone). All README commands must work on Windows (PowerShell).

### 0.1 Work in small, resumable steps (very important)

I may hit a usage limit at any moment and continue hours or days later in a **new session that remembers nothing**. The project must never be left broken, and any new session must be able to continue exactly where the last one stopped.

**Split the work**
- In PLAN.md, break every phase into numbered **tasks** (e.g. `2.3 XP engine + unit tests`). Each task must be small: roughly 1–5 files, finishable in one short sitting, and testable on its own.
- Order tasks so the app **builds and runs after every task**. Never start a task that leaves the app broken until a later task fixes it. Build bottom-up: data/types → logic + tests → UI.
- Large files are written in parts; no single file over ~300 lines (split into modules).

**`PROGRESS.md` — the single source of "where are we"**
- A checklist of every task in every phase: `[ ]` not started, `[~]` in progress, `[x]` done.
- At the top, a short **"Resume here"** block: current task, what is already done inside it, the exact next step, any open questions for me, and anything currently broken.
- Update it **before** starting a task (mark `[~]` and write the next step) and **right after** finishing one. Never batch these updates.

**Save points**
- After every finished task: run type-check + tests, then **git commit** (`task 2.3: XP engine + tests`). One task = one commit. If the build or tests fail, fix before committing — never commit broken code to `main`.
- If a task is interrupted halfway, the next session first checks `git status`: either finish it, or discard the half-done changes (`git restore`) and restart that task from the last commit. Never build on top of unknown half-finished work.
- Push to a **private GitHub repository** after each task (I'll create it when you ask), so the work is safe even if my laptop fails.

**Start of every session (do this first, every time)**
1. Read `CLAUDE.md`, `SPEC.md`, `PLAN.md`, `DECISIONS.md`, `PROGRESS.md`.
2. Run `git status` and `git log -5`, then install dependencies and run the tests.
3. Tell me in 2–3 lines: where we are, what you will do next. Then continue.

**When you sense the session is getting long**, stop at the next save point, update `PROGRESS.md`, commit, and tell me — don't start a new big task near the end.

**My resume prompt** (I will paste this in any new session):
> Read CLAUDE.md, then PROGRESS.md. Check git status. Continue from "Resume here", following SPEC.md section 0.1.

---

## 1. About me (the user)

- Name: Rishi. India (timezone **Asia/Kolkata**).
- 2026 B.Tech graduate in AI & Data Science.
- Long-term career direction: **AI & Robotics (70%)** and **AAA game development (30%)**. My big dream is to become a robotics engineer at a top company or research lab. My job search is paused for now while I focus on this roadmap.
- I want to improve in three areas: **Body & physique**, **Career & skills**, **Mind & discipline**.
- I struggle sometimes with oversleeping, distraction and consistency. The app must help me *start* and *keep going*, not make me feel guilty.

---

## 2. The idea

Inspired by the *concept* of a personal "System" from the anime Solo Leveling: a quiet presence that gives me daily quests, tracks my stats, and shows me growing stronger over time.

**Important:** This is NOT a fan app. Do not use any names, characters, artwork, logos, sounds or text from the anime. Everything must be original. Keep the *feeling* (quests, levels, ranks, a System that speaks to me) but make it calm, mature and grounded in real life.

**North star:** Open the app → know exactly what to do today → do it → see real progress → come back tomorrow. For years.

---

## 3. Product principles (follow these in every decision)

1. **Consistency over intensity.** Rewards favour showing up daily, not doing huge amounts once.
2. **No punishment spirals.** Missing a day never wipes progress. No losing levels. Instead: a gentle "Recovery quest" the next day.
3. **Minimum Viable Day.** Every day has a tiny version (e.g. 10 push-ups, 15 min study, wake on time) that counts as "showing up" on bad days.
4. **Real goals, not just game points.** Every quest connects upward to a goal and a dream.
5. **Honest numbers.** XP can't be farmed; there are daily caps and diminishing returns.
6. **Calm, not addictive.** No dark patterns, no infinite feeds, no guilt notifications.
7. **My data is mine.** Works offline, exportable anytime, never lost.
8. **Everything is editable, history is protected.** I can change, add, pause, archive or restore any dream, goal, milestone, quest, habit, schedule, difficulty or minimum version at any time — my life and goals will change over the years. Edits apply from today forward only: past completions and XP stay exactly as they were (store a snapshot of the quest title/difficulty on each `quest_instance`). Archived items can be restored. Permanent delete exists only behind a clear confirmation and is never the default.

---

## 4. Core game system

### 4.1 Player
- Level, total XP, Rank, Title, current streak, longest streak, "days active" (lifetime count — never resets).

### 4.2 Stats (three, one per life area)
| Stat | Area | Grows from |
|---|---|---|
| **STR** (Strength) | Body & physique | workouts, steps, sleep, nutrition logs, body check-ins |
| **INT** (Intellect) | Career & skills | study, coding, projects, job applications, interview prep |
| **WIL** (Willpower) | Mind & discipline | waking on time, focus sessions, no-phone blocks, journaling, meditation |

Each stat has its own level. Overall Player level comes from total XP.
Show a simple radar/triangle chart so imbalance is visible (gently nudge the weakest stat).

### 4.3 XP and levels (put all numbers in one config file so I can tune them)
- XP to reach level `n` from `n-1`: starting formula `round(50 * n^1.4)`, tuned with the simulation in 4.8.
- Quest XP by difficulty: Easy 10, Normal 25, Hard 50, Epic 100.
- **Daily XP soft cap**: after 300 XP in a day, further XP is halved. Prevents grinding.
- **Streak bonus**: +2% per streak day, capped at +30%.
- "Daily Clear" bonus (+20 XP) — definition in 4.8.
- XP is **never lost** for missing days or for any other reason. The only change allowed is correcting a mistaken tap on the same day (4.8).
- Exact calculation order and edge cases: section 4.8. If anything here seems to conflict with 4.8, 4.8 wins.

### 4.4 Ranks (long-term, based on consistency, not just level)
E → D → C → B → A → S. Rank-up requires BOTH a minimum level AND a minimum number of active days (e.g. D: level 5 + 14 active days; S: level 60 + 900 active days). Define all six thresholds in config, set by the simulation. Ranks never go down. Rank-up is a rare, special moment.

### 4.5 Quest types
- **Daily Quests** — recurring habits (e.g. wake by 5:00, 30 min workout, 150 min AI & Robotics study, 10 min journaling — my real list is in section 14). Each has a full version and a **minimum version**.
- **Main Quests** — long-term goals (e.g. "Core robotics skills", "Robotics portfolio", "Get admitted to an MS in Germany"). Broken into **Milestones** ("Boss fights") with target dates.
- **Weekly Quests** — 3–5 concrete steps toward Main Quests. Proposed automatically by the Goal Planner (6.3); I confirm or edit them during the weekly review. If I skip the review, the proposal is applied automatically on the week's first day with Undo (this happens whether or not Auto-plan mode is on, because an empty week helps nobody). Shown on Today in a "This week" section, not as daily cards.
- **Side Quests** — one-off tasks.
- **Recovery Quest** — appears after a missed day: small, kind, doable in 10 minutes.

### 4.6 Dungeons = focus sessions
- Timer for deep work (default 25/5 or 50/10, configurable). Choose which quest/stat it's for.
- During a session: minimal full-screen view, optional "phone face-down" honesty check.
- Completed sessions either count toward the linked quest or give XP to the chosen stat (exact rule in 4.8). Abandoned sessions still count the minutes actually focused toward a linked quest, but give no XP of their own and no penalty.
- A session can also be tagged with skills (6.5).

### 4.7 Titles & achievements
Original, quiet achievements tied to real behaviour: "First Light" (7 wake-ups on time), "Iron Habit" (30-day workout streak), "Applicant" (first 10 job applications), "Centurion" (100 active days), etc. Make ~40 at launch, defined in a data file so I can add more. I choose one unlocked title to display on my profile.

### 4.8 Exact rules (implement precisely; these are what make everything consistent)

**Days and weeks**
- A "day" runs from the day-start hour (default 4:00 AM) to the next day-start hour, in my current timezone. Every record stores its day as a local date string (`YYYY-MM-DD`) computed **at the moment of the action** and never recomputed later — so moving to another country (e.g. Germany) never shifts past history.
- Weeks start on Monday (configurable).
- "Day N" in System messages = number of days since I started using the app (day 1 = onboarding day).
- The timezone used is the device's current timezone, saved on each `days` record.

**Active day, streaks, recovery**
- A day is **active** if I complete at least the minimum version of every *core* daily quest scheduled that day (each habit has a `core` flag; I choose which are core, max 3, during onboarding and in Settings). Low-energy days count as active if those minimums are done.
- A day with **no core quest scheduled** (e.g. a rest day) is **neutral**: it neither breaks nor extends the streak and doesn't add to days active.
- **Streak** = consecutive active days (neutral days skipped). **Days active** = lifetime count, never resets.
- **Streak shields**: I earn 1 shield every 7 consecutive active days (max 3 stored). A missed day uses a shield automatically and the streak continues.
- **Recovery quest**: after a missed day with no shield, the next day shows a Recovery quest. Completing it that day **repairs** the missed day for streak purposes (max once per 7 days). Days active is not changed by repair.
- Each habit also has its own streak (needed for achievements like "Iron Habit"), counted only over the days it is scheduled. When a day is protected by a shield or repaired, the core habits' streaks are protected too.

**Daily Clear**
- Earned when every daily quest scheduled that day is done at least at minimum version. On a low-energy day, only core quests are required. Weekly and side quests never affect Daily Clear.

**Low-energy mode**
- Applies to today only, can be turned on any time before the day closes and turned off again the same day (quests return to full versions; anything already done stays done).

**Measurable quests**
- Every habit has a `measure`: `check`, `minutes`, `count`, `steps` or `sleep_hours`. For numeric measures there is a `target_value` (full) and `min_value` (minimum); reaching the minimum = `done_min`, reaching the target = `done_full`.
- For `check` quests the full and minimum versions are described in words (e.g. full "30 min workout", minimum "10 push-ups"). When completing, I tap **Full** or **Minimum** (one tap, no typing).
- A late wake-up check-in (`done_late`) counts as meeting the minimum for active-day and Daily Clear purposes.
- **Sleep** is counted for the day I **wake up into**: the night that ends on the morning of Tuesday belongs to Tuesday, whatever time I fell asleep.
- Before Health Connect exists (Phase 10), steps and sleep are entered manually with quick inputs (stepper / hour picker). Before notifications exist (Phase 6), the wake-up check-in is an "I'm up" button at the top of Today, active from the wake time until the window ends.
- Progress adds up during the day from any source (several focus sessions, Health Connect steps, manual entry). The status upgrades automatically from min to full, and the XP difference is awarded as a top-up, never twice.
- Progress is stored as separate **progress entries** (source, amount, occurred_at), never as one number that devices overwrite. Quest progress = sum of entries for `minutes`/`count`; for `steps`/`sleep_hours` from Health Connect, use the latest reading for that day (those are totals, not additions), plus manual entries if I add them. This way a focus session on the laptop and a manual entry on the phone both count after sync.

**XP — order of operations** (one pure function, fully unit-tested)
- `xp_events` store only the **base award** (step 1). Steps 2–4 are applied by the progress engine when it computes each day's total, processing that day's events in `occurred_at` order. This keeps the result identical no matter which device earned the XP or in what order things synced.
1. Base XP from difficulty (Easy 10, Normal 25, Hard 50, Epic 100). Minimum version = 50% of base. Late wake-up check-in = 50%. Recovery quest = Easy.
2. Apply streak bonus, using the streak **as it was at the start of that day** (+2% per streak day, max +30%).
3. Apply daily soft cap (XP beyond 300 for that day is halved).
4. Round to an integer. The level-up moment shows the final number.
- Daily Clear (+20) and other bonuses go to the **player total only**, not to any stat, and are not affected by the soft cap.
- Stat levels use the same curve as the player level but apply to that stat's XP only.

**Focus session XP**
- A session **linked to a quest** gives no separate XP: its minutes count toward that quest's `minutes` target, and the quest gives the XP when it reaches min/full.
- A session **not linked to a quest** gives 1 XP per focused minute to the chosen stat (soft cap still applies).

**One real action = one XP award** (prevents double counting)
- Each quest instance can hold **at most one net award per day** (min, or full, or late). XP events have an idempotency key (`quest_instance_id:award_type:revision`), so the same event written twice — on any device, after any sync — is stored once.
- Health Connect auto-completion and manual completion of the same quest on the same day → one award.
- Logging a job application counts toward my linked "apply to jobs" quest if I have one; if not, it creates and completes an automatic Easy side quest "Applied: <company>". Either way, the XP comes from a quest instance, never separately from the log.
- **Correcting a mistake:** un-ticking a quest on the same day writes a compensating negative event (`revision` +1), so the net award returns to zero; ticking again writes a new award. `xp_events` stays append-only. After the day closes, I can no longer tick or un-tick that day's quests in the app. This is the only case where XP goes down.
- **Late-arriving actions:** an action that really happened on an earlier day but arrives later (offline phone syncing, widget or notification queue processed the next morning) is still accepted for its original day. That day is re-evaluated (e.g. missed → active), and streaks and XP are recomputed. "Closed" blocks new edits from me, not real actions arriving late.

**Weekly quests at week end**
- Unfinished weekly quests are simply closed as "not done" (no penalty) and offered for carry-over in next week's proposal.

**Balance check**
- Write a small simulation script (`scripts/simulate.ts`) that models a realistic user (e.g. 80% completion, some low-energy days, some missed weeks) for 5 years and prints level, stat levels and rank per year. Tune the config until: ~level 25–30 after year 1, ~level 55–60 after year 5, rank S not before year 4–5. Include the output in PLAN.md.

---

## 5. Goals → Dreams hierarchy (very important for long-term use)

```
Dream / Life Vision (5–10+ years)   e.g. "Build my own AI/robotics company"
 └─ Main Quest (1–3 years)           e.g. "MS in AI in Germany"
     └─ Milestone (1–3 months)       e.g. "IELTS band 7.5"
         └─ Weekly Quest             e.g. "2 full mock tests"
             └─ Daily Quest / Focus session
```
- Every Main Quest shows % progress, milestones, deadline, and "why this matters to me" (written by me, shown when I'm losing motivation).
- A "Vision" screen shows my dreams with the progress beneath them.
- Goals can be paused, completed, or archived (never deleted by accident; archive keeps history).

---

## 6. The "System" — rules engine + optional AI

### 6.1 Rule engine (default, free, works offline)
- Generates each day's quest list from my active habits and weekly quests.
- Adjusts difficulty: if I complete <50% for 3 days, suggest switching to minimum versions; if I clear 100% for 7 days, suggest raising one habit a little.
- Writes short System messages from templates: morning briefing, level-up, rank-up, recovery, weekly summary.
- Tone: calm, direct, respectful. Example: *"Day 214. Three quests today. Start with the smallest."* Never shaming, never cringe.

### 6.2 AI coach (optional, switch on in Settings)

> **Replaced (Rishi, 2026-11-03):** the LLM AI coach below is not built. Phase 8 is now "Adaptive System + Growth Compass + Ask the System" — see **section 6.7**. Kept here for history; the `AIProvider` interface idea survives in 6.7 Part C.
- Provider-agnostic interface (`AIProvider`) so I can use Claude or another model with my own API key.
- The key is stored only on the server, never in client code or git.
- Features: break a goal into milestones and weekly quests; weekly review summary + 3 suggestions; turn a messy brain-dump into quests; answer "what should I do now?".
- AI *suggests* and I approve with one tap ("Accept all", or accept/edit/reject per item).
- **Auto-plan mode** (Settings, works with both the rule engine and the AI): routine follow-ups (next milestone's plan, small difficulty adjustments) are applied automatically with a visible "Undo" and a note of what changed. Big changes (new dreams, deleting, replacing or re-dating goals, adding new daily habits) always need my approval.
- The API key is set as a server secret during deployment (documented in README), not typed into the app. Settings only shows whether AI is connected.
- Guardrails: no medical diagnoses, no extreme diets or unsafe training; recommend a professional for health issues.
- If AI is off or offline, everything still works through the rule engine.

### 6.3 Goal Planner — the System plans so I don't have to type
I should almost never have to type quests by hand. Whenever I make a **meaningful change** to a dream, main quest or milestone — create it, change its deadline, scope or target, pause, resume, finish or archive it — the System runs this flow. Small edits (fixing a title, editing "why") do not trigger it. Every goal also has a "Re-plan" button to run it manually anytime.

When a goal is paused, finished or archived, the plan preview also proposes what to do with its linked habits and weekly quests (pause, keep, or re-link), so nothing is left orphaned.

1. **Analyze** — look at the new/changed goal, my other active goals, my current daily load, my recent completion rate, and my available time. Detect conflicts (too many goals, unrealistic deadline, a stat being neglected).
2. **Ask** — a short interview of 3–6 questions, mostly tap-to-answer (chips, sliders, yes/no), with typing optional. For example: deadline, current level ("beginner / some experience / advanced"), hours per day available, which days, what has stopped me before, what "done" looks like.
3. **Plan** — generate milestones with dates, this week's weekly quests, and any new daily quests (each with a minimum version), sized to fit my real available time.
4. **Show the impact** — a clear preview: what gets added, what changes, what gets removed or rescheduled (e.g. "Moving your IELTS deadline 2 months earlier adds 1 study block per day; I suggest reducing coding practice from 60 to 45 min"). I approve with one tap or edit any item.
5. **Follow up automatically** — after that, without me typing:
   - Every week (during the weekly review, or automatically on my chosen day), generate next week's quests from the current milestone and how last week went.
   - When a milestone is completed, unlock and plan the next one.
   - When a deadline is at risk (progress behind schedule), warn me and offer 2–3 options: extend deadline, add time, or reduce scope.
   - Check in on each main quest every ~30 days with 1–2 questions ("Is this goal still important to you?") and adjust the plan.
6. **Remember** — store my answers to the interview on the goal (`planner_context`) so future plans use them and I'm never asked the same thing twice.

**Without AI (rule engine):** use built-in plan templates for common goals (fitness/recomposition, exam prep (IELTS/GRE), university application (APS/Germany), learning a skill, building a portfolio project, job search, habit change) filled in from my interview answers, plus simple rules for weekly generation. Templates live in data files so new ones can be added.
**With AI coach on:** the AI does steps 1–4 for any goal, using templates as a starting point, and returns structured JSON (validated against a schema before saving — never trust raw AI output).

Every auto-generated item is marked "planned by System", can be edited like anything else (principle 8), and is logged in a **Plan history** so I can see and undo what changed and why.

### 6.4 Daily-use helpers (less typing, more doing)
- **Wake-up check-in** — at my wake time, a notification "Day N. Are you up?" with one button "I'm up". Tapping it within a window (default 20 min) completes the WIL wake-up quest automatically. Late taps still count as "done (late)" with reduced XP, never a failure message. The **time of the tap** is what counts (stored with the action), not the time the app later processes it. If the app hasn't been opened for 7+ days, reminders pause except one gentle welcome-back message.
- **Low-energy day mode** — one button on Today: "Low energy today". Switches all of today's daily quests to their minimum versions, hides non-core quests (they can be shown again with one tap), keeps the streak alive per the rules in 4.8. Shows how many times it was used this month (honesty, not shame). If used 4+ days in a row, the System gently asks if something needs to change (sleep, load, health) and suggests seeing a doctor or talking to someone if it continues.
- **Auto-tracking (Android)** — connect to **Health Connect** (via a Capacitor plugin) to read steps, sleep and workouts with my permission. Data is read when the app opens or resumes (and via a periodic background job if the plugin supports it). Auto-complete matching quests (e.g. "8,000 steps") and fill body logs, marking the source as `health_connect`. Manual entry always remains possible and wins if I edit a value. On web/laptop, this data appears after sync and is read-only there.
- **Home-screen widget (Android)** — small widget: level + XP bar + today's quests with tap-to-complete; medium widget adds a "Start focus" button. Technical requirement: an Android widget is native code and **cannot read the WebView's IndexedDB**. So:
  - The app writes a small "today snapshot" (level, XP, today's quests with ids and status) to native shared storage (e.g. Capacitor Preferences → SharedPreferences) every time something changes and at day rollover.
  - Widget taps update the widget immediately and add an entry to a native **pending-actions queue**. When the app opens or resumes, it processes the queue through the normal action pipeline (6.6), so XP, streaks and sync stay correct.
  - If the snapshot is from a previous day, the widget shows "Open to start today" instead of stale quests.

### 6.5 Career tools (for my current goals)
- **Skill tree (INT)** — a visual tree of skills grouped into branches. Start with my roadmap: **AI & ML** (Python, math for ML, deep learning, computer vision, reinforcement learning); **Robotics** (C++, ROS 2, kinematics & dynamics, control, SLAM & navigation, simulation e.g. Gazebo/Isaac Sim, embedded/electronics basics); **Game development** (C++ for games, Unreal Engine, game math, gameplay systems, rendering basics); **Engineering** (Git, Linux, testing). Show the 70/30 AI-Robotics vs Games balance of my study time per week. Each skill has levels 0–5 earned through linked focus sessions, quests and finished projects (with notes/links as proof). Branches and skills are editable and stored as data, so I can add robotics, design, German, etc. later. Clean and minimal visually — nodes and lines, no clutter.
- **Job application tracker** (my job search is paused, so build it but keep it hidden until I switch it on in Settings; it will also be useful for internships and lab positions later) — pipeline: Saved → Applied → Assessment → Interview → Offer / Rejected / Ghosted. Each entry: company, role, link, date, source, salary range (optional), notes, next follow-up date. Logging an application or interview completes career quests and gives INT XP (exact rule in 4.8). Follow-up reminders after 7 days. Simple stats: applications per week, response rate, stage where I drop most. The Goal Planner uses these stats (e.g. many rejections at interview stage → suggests mock-interview quests).

### 6.6 How all the parts connect (architecture rule)
Every part of the app must communicate through **one action pipeline**, so nothing gets out of sync.

```
Input (tap, widget queue, Health Connect, focus timer, job log, planner, sync)
  → recordAction(action)            single entry point, validates + idempotency check
  → one database transaction:
       update quest_instance / session / log
       write xp_event(s)            (rules in 4.8)
       update day record            (active, daily clear, low energy)
  → emit domain event               e.g. QuestCompleted, DayClosed, MilestoneDone,
                                     GoalChanged, LevelUp, RankUp, SessionFinished
  → subscribers react:
       Progress engine   → level, stat levels, rank, streaks (derived, cached)
       Achievements      → check unlock conditions
       System messages   → level-up / rank-up / recovery text
       Goal Planner      → milestone progress, follow-ups, deadline risk
       Skill tree        → add evidence, recompute skill level
       Widget bridge     → refresh today snapshot
       Notifications     → reschedule reminders
       Sync queue        → mark records for upload
```
- No screen or component writes to the database directly or calculates XP itself — they call `recordAction` and read from derived state.
- Derived values (level, rank, streaks, stat levels, skill levels, goal progress) are **always recomputable** from the stored records; cached values are rebuilt on app start if anything looks inconsistent. Provide a hidden "Rebuild progress" option in Settings.
- **Day rollover job** runs on app open/resume and at the day-start hour: closes past days (marks missed quests, applies shields/recovery), generates today's quests, triggers weekly generation on the week's first day, refreshes widget and notifications. It must handle being run late, twice, or after weeks away, with the same result.
- **Goal progress** is calculated, not typed:
  - Each milestone has a target type: `metric` (e.g. weight 70 kg, read from body logs), `count` (e.g. 6 mock tests, 40 applications — counted from linked quests/job logs), or `manual` (I mark it done).
  - Milestone % = current ÷ target for metric/count; for manual milestones, completed linked weekly quests ÷ the planner's estimated total for that milestone (capped at 90% until I confirm it's done).
  - A milestone is completed only when the target is reached or I confirm it — never automatically from a percentage guess.
  - Main quest % = completed milestones weighted by `size_weight` ÷ total weight. Dream progress = average of its active main quests.
  - Every habit and weekly quest can link to a milestone or main quest (principle 4); unlinked ones count toward their stat only.

### 6.7 Phase 8 — Adaptive System, Growth Compass, Ask the System (replaces 6.2)

Rishi's full instruction is kept verbatim in `docs/phase8-prompt.md`; this section is the buildable version. Free by default. The only external service is Google Gemini's free tier, used only by the optional Part C. Build order: **A → B → D → C**.

**Rules for the whole phase**
- Every suggestion explains itself ("based on your last 6 Mondays…") and shows a confidence: *early guess* / *likely* / *confident*. Nothing changes without approval; every applied change goes through the plan path (Plan history + Undo). At most **one suggestion card on Today** at a time (one priority list decides which).
- Never push harder during a low-energy streak (2+ low-energy days in the last 3); never suggest less sleep (a sleep target is never lowered).
- Nothing is hard-coded to Rishi's quests: every model works per habit/goal of any user.
- On-device parts are pure, deterministic and recomputable from stored records (same data → same result on every device), work with sync, and stay within the 10-year performance budgets (`npm run perf`).
- Rishi uses the app daily: every schema change is a Dexie version with an upgrade that keeps old records valid; old backups keep importing.

#### Part A — Adaptive System (on-device learning)
- **Data recorded** (new synced table `learning_events`, schema v2): suggestion events (`shown` / `accepted` / `edited` / `rejected` / `ignored`, time, suggestion type, ref); notification events (`scheduled` / `delivered` when observable / `opened`, and minutes from open to the related action); app opens (time); planned vs actual per week (written when a week closes: planned minutes/quests vs done). Numbers and patterns only — never journal or free text.
- **Models** (pure, in `src/core/adaptive/`): per daily quest × weekday a Beta-Bernoulli completion probability with recency weighting (half-life ~4 weeks) and a prior from the user's own overall rate (cold start: the existing rule engine + prior 0.7); recency-weighted averages of minutes, sleep and completion; best hours (when completions, progress entries and focus sessions actually happen); real weekly capacity (minutes actually done per week); acceptance rate per suggestion type (types rejected often are shown less, never below a floor so they can recover). Confidence grows with evidence; only *likely*/*confident* insights are shown at first.
- **Reset learning** per habit and overall (a synced reset marker; models ignore data before it). Learning data stays on the device and in the user's own synced account.
- **Features:** "At risk today" (quests most likely to be skipped, highlighted on Today) · "What should I do now?" (one best next action from time of day, risk, core flag and goal deadlines, with why) · adaptive difficulty toward ~80% full success per quest (dead band + 14-day cooldown so it never oscillates; never below the minimum; replaces the 3-day / 7-day rules of 5.8, keeping the low-energy note) · learned best times for focus and reminders (suggested as a setting change, approval first) · weekly plans and planner proposals sized to real capacity · goal guidance: forecast milestone and main-quest finish dates from real pace, early "behind" warning, catch-up options, and a suggested **focus goal of the week** (feeds the weekly plan and weekly review) · early burnout warning (completion slipping + low-energy days + short sleep → offer a lighter week, never more load) · **"What the System knows about you"** page: every learned item in plain words with its confidence, each clearable.
- **CSV export** of the learning data (Settings → My data) for a future bigger model.

#### Part B — Growth Compass (Career + Health only)
- Deterministic, offline, free guidance from a **versioned knowledge pack** (`src/data/compass/`, Zod-validated at test time), every entry with its source and link: ESCO and O*NET (careers, skills, RIASEC interest profiles; O*NET under CC BY 4.0 with attribution shown), official university / DAAD pages, official learning documentation (e.g. ROS 2, Unreal Engine), WHO guidelines (physical activity, sleep, healthy diet), ICMR-NIN Dietary Guidelines for Indians, recognised sleep/exercise science bodies. No unverified web content. Changeable facts (deadlines, fees, requirements) are marked **"Check the official site"** with the link.
- **Scope:** career discovery, skill development, career roadmaps, physical health, sleep, recovery, nutrition basics, mental wellbeing. Anything else is politely declined.
- **Career pillar:** career → skill graph with prerequisite order, mapped onto the skill tree; guided **career discovery** (short RIASEC-style interests + strengths + values) suggesting matching careers with explanations (works for any user); **gap analysis** against a chosen career → roadmap of missing skills in prerequisite order → milestones and weekly quests via the Goal Planner (approval, undo). Learning roadmaps in the pack: AI/ML, ROS 2, C++, robotics math, simulation, Unreal Engine; IELTS, GRE, APS / German university process with typical step durations; study science (spaced repetition, deep work, restarting after a break).
- **Health pillar:** guided health check-in (activity level, sleep, energy, goals: strength, fat loss, stamina, better sleep, less stress); gap analysis against WHO guidelines from real data (workouts, steps, sleep, weight, energy/mood check-ins, low-energy days, Health Connect when available); health roadmap (gradual training progression, sleep routine, simple nutrition habits suited to Indian food) → quests via the Goal Planner (approval, undo); **career–health balance** (Adaptive System insights such as sleep vs next-day completion and heavy study weeks balance load and recovery in weekly plans).
- **Health safety (non-negotiable):** no diagnosis, medication or treatment advice; pain, injury or illness → "please see a doctor". No extreme diets or training; safe weight-change rate only (≤ ~0.5–1 % of body weight per week), warn if weight drops faster. Mental wellbeing is supportive, not therapy: if mood check-ins stay very low for a sustained period (e.g. average ≤ 2 over 7+ check-ins in 14 days), gently suggest talking to someone trusted or a professional and show a verified helpline for the user's country (India: Tele-MANAS; number verified at build time; Germany configurable later). **Health data (sleep, weight, mood/energy, body logs, photos) never leaves the device and the user's own synced account — never sent to any online AI.**
- Every recommendation explains why and shows its source; readiness forecasts use the Adaptive System's real pace.

#### Part D — Data ownership and storage (whole app)
- All data stays on the device and in the user's own private synced account. No analytics, tracking, selling or third parties — except the minimal non-sensitive text sent to Gemini in Part C, only when the user asks a question. Nothing about the user trains any outside model.
- **Settings → My data:** what is stored (per kind, counts), space used (device via the storage estimate; cloud via a server function), what is ever sent outside and when (a local log of every Ask request), buttons for full export, compaction and **Delete everything** (clear confirmation + automatic final export; removes device data and cloud data, and the account itself if chosen, via an Edge Function).
- **Compaction** (keep a short summary, remove old detail): offered by a calm notice above a size threshold, or any time. The user picks a cutoff (e.g. older than 1 year). First an automatic full export (photos optional), then a preview of exactly what will be summarised and the space saved; nothing happens until confirmed. Old detail (quest instances, progress entries, XP events, focus sessions, body logs, old plan history/proposals, learning events) is replaced by **week/month summaries** keeping: XP per stat and total, levels, ranks, achievements, titles (progress identical before and after); streak history, active days, Daily Clears, low-energy days, shields used (the `days` records themselves are kept); per-quest completion rates (full/min/missed), total minutes/counts; focus hours per stat and per skill; skill levels and evidence; sleep, steps, weight and waist averages and trends (photos optionally kept); goals, milestones and completion dates; review stats and every written reflection (reviews are kept); the Adaptive System's learned parameters. Heatmap, yearly summaries, Profile charts and the Adaptive System keep working from summaries. Compaction is synced (a compaction record; other devices remove the same detail and never re-upload it; the server drops it too) and listed in an in-app compaction history (date, cutoff, space saved).
- Tests: progress (XP, levels, ranks, streaks, skill levels, days active) identical before and after; summaries survive export/import and sync; nothing newer than the cutoff is touched.

#### Part C — "Ask the System" (optional, built last)
- An **Ask the System** screen for questions in the user's own words, answering only career and health/growth questions; off-topic questions are declined politely (a local scope check first, so they cost no quota; the model is also instructed to refuse).
- Uses the `AIProvider` interface (Claude can be added later) with **Gemini's free tier** (Google Search grounding where available) through a Supabase Edge Function that holds `GEMINI_API_KEY` as a Supabase secret (Rishi sets it himself with a PowerShell command; never pasted into chat). Requires a sync account and internet.
- Grounded in the Growth Compass knowledge and the user's progress; always shows sources/links. **Allowed context:** goal/skill/quest progress and completion numbers. **Never sent:** health data, journal text, mood/energy, photos. A short note says free-tier questions may be used by Google.
- An answer can become suggested quests or plan items — applied only after approval, undoable.
- Daily question limit and caching keep it inside the free quota; over quota, offline, signed out or key missing → a calm fallback to the Growth Compass ("Try again later"), never an error screen. On/off switch in Settings (`ai_enabled`).

**Phase tests:** prediction calibration; simulated users (`scripts/simulate.ts`) showing adaptive difficulty improves adherence without oscillating; health safety rules; scope refusal; Ask fallback paths; no sensitive data ever sent; compaction invariants.

### 6.8 Phase 11 — Screen Time (phone only, simple, never blocking)

Rishi's full instruction is kept verbatim in `docs/phase11-prompt.md`; this section is the buildable version. **Phone only (Android).** Above all **simple**: setup takes under 3 minutes and needs no decision beyond accepting a suggestion. It supports willpower; **it never blocks anything**. **Off by default** (feature flag `screenTime`; Settings → Screen time).

**Setup — 3 steps, nothing more**
1. One **"Allow screen time"** button that opens Android's Usage access screen for ASCEND, with a short guide (incl. the Nothing OS path). Nothing else to configure.
2. **Observe week:** for 7 days ASCEND only measures, quietly — no reminders, no questions.
3. After 7 days, **one card** on Today: "You average Xh Ym of entertainment a day. Set your daily limit to Z min?" — Z is a realistic step down from the average (rounded to 15 min). Buttons: **Accept** (locks for 1 week) / **Edit**. That's the whole setup.

**What it tracks**
- Android `UsageStatsManager` via a small native plugin: **daily totals per app only** (seconds per app per ASCEND day — day-start hour and local timezone, 4.8). Nothing about what happens inside an app.
- A **built-in list of entertainment apps** (data file): YouTube, Instagram, Facebook, X, Snapchat, Netflix, Prime Video, JioHotstar, SonyLIV, ZEE5, aha, MX Player, Crunchyroll, Twitch, Webtoon, Cricbuzz, Dream11 and common games (Android's "game" app category). Everything else is never limited. Rishi can **add or remove apps** from the list; removing waits for the lock to end.
- **During a focus session YouTube doesn't count** (its time inside focus sessions is kept apart).
- A simple **Screen time card** on Today and a **Screen time screen**: today vs the limit, this week, top apps.

**Reminders (never blocking)**
- Only for entertainment apps, only in **two cases**: (1) over the daily limit; (2) on an entertainment app **after the wind-down time** (the existing evening wind-down time, default 21:00, until the day-start hour — protects the 5:00 wake-up).
- A gentle **first notification**, then a **re-alert every 1 minute** (fixed) while an entertainment app is still in front — **one ongoing notification updated** with the time spent, never a stack. Buttons: **Start focus** (opens Focus) and **I'm on a break** (pauses reminders 20 min, **max 2 per day**). Calm wording, never shaming.
- **Quiet hours:** reminders still update the notification, but **silently** (no sound or vibration) — Rishi's choice, 2026-11-04.
- Its **own notification channel**, separate from the wake-up and other reminders.
- A small **foreground service** (with its required ongoing notification) runs **only while a reminder is active**; otherwise no background checking. It is started by an exact alarm at the wind-down time, and for "over the limit" by an alarm at the earliest moment the remaining allowance could run out (re-checked then). It checks the foreground app once a minute and not at all while the screen is off; it stops when the reminder case ends. Battery impact is measured on the Nothing Phone (3a).

**Lock (automatic, invisible until needed)** — a deliberate exception to principle 8
- Accepting or changing the limit locks it for **1 week** (option: 1 month).
- During the lock the limit can be **lowered** (and apps added) anytime; **raising** it, **removing apps** from the list or **turning reminders off** only takes effect when the lock ends, with the date shown.
- If during a lock ASCEND's notifications or the screen-time channel are turned off, or Usage access is removed: a **banner on Today** until fixed, and the **lock extends by 7 days** (per incident). Checked whenever ASCEND opens/resumes and by the service. No XP loss.
- Locks are **synced**; the end is judged by trusted time (the server's clock from any ASCEND request, so moving the phone's clock never ends a lock early); reinstalling and signing in brings the lock back; importing a backup or "Delete everything" never removes or shortens an active lock.

**Connected to the System**
- A **"Digital discipline"** daily quest (WIL, Easy, check): done automatically when the day's entertainment stayed under the limit, judged when the day closes. Counts toward Daily Clear like any daily quest (Rishi, 2026-11-04). Added when the first limit is accepted.
- **One line in the weekly review:** entertainment time vs last week. No XP loss, no guilt.

**Privacy and rules**
- Only daily totals; on the device and Rishi's own synced account only; **never sent to any AI** (Ask the System's allow-list excludes it). Included in export, compaction (old days → monthly totals) and "Delete everything" — which doesn't remove an active lock.
- Never break existing user data: new tables in a new Dexie version, existing records untouched, old backups keep importing.
- **Tests:** observe week, limit suggestion, reminder cases (incl. YouTube during focus, quiet hours silent, 1-minute re-alerts), break cap, lock rules (clock and import attempts, the 7-day extension), privacy. A short real-phone checklist for the Nothing Phone (3a) at the end.

---

## 7. Screens

Mobile-first. On laptop/desktop use a left sidebar and wider layouts (two columns where useful) — not just a stretched phone.

**Navigation** — mobile bottom bar has exactly 5 items: **Today · Quests · Focus · Goals · More**. "More" opens: Body, Review, Skills, Jobs, Profile, Settings. On desktop the sidebar shows all items. Today is always one tap away.

1. **Onboarding ("Awakening")** — 5 short steps: name, wake time, pick starter daily quests from suggestions (each pre-filled with measure, target and minimum version, all editable) and mark up to 3 as core, first Dream + Main Quests, choose theme. For me, pre-fill every step from my answers in section 14 so I only need to confirm. Under 3 minutes. If onboarding happens after 6 PM, ask "Start today or tomorrow?" — a day started late is neutral, so the first day is never a "missed" day.
2. **Today (Status)** — level, XP bar, rank, streak, the 3 stats, today's quests as tappable cards, a "Start focus" button, one System message. This is the home screen and must load instantly.
3. **Quests** — tabs: Daily / Weekly / Main / Side. Create, edit, reorder, pause, archive.
4. **Vision & Goals** — dreams → main quests → milestones tree with progress.
5. **Focus (Dungeon)** — timer, linked quest, session history.
6. **Body** — weight, waist, optional photos (stored locally/privately), workouts, sleep hours, steps; simple trend charts.
7. **Review** — daily 1-minute check-in (energy 1–5, mood 1–5, one win, one lesson), weekly review flow (what went well / what didn't / next week's weekly quests), monthly and yearly summaries.
8. **Profile / Stats** — stat radar, XP history, heatmap calendar of active days (GitHub-style, multi-year), achievements, titles.
9. **Skills** — the skill tree (6.5).
10. **Jobs** — application pipeline as a list on mobile and columns (board) on desktop, plus simple stats (6.5).
11. **Settings** — theme, day-start time, week start, wake-up window, core quests, notifications and quiet hours, AI coach on/off + monthly budget, Auto-plan mode, Health Connect, sync account, **export/import data**, rebuild progress, reset options with confirmation.

**Goal Planner** is not a separate screen: it opens as a full-screen step-by-step sheet whenever a goal is created or changed, and its proposals appear as a review card on Today and in Goals.

---

## 8. Design system — minimal & calm, but beautiful

- **Feel:** a quiet premium tool. Gaming hints appear only in levels, ranks, XP bars and achievements — not everywhere.
- **Themes:** light and dark, follow system by default.
  - Dark: background near-black blue `#0E1116`, surfaces `#161B22`, text `#E6EDF3`, muted `#8B949E`.
  - Light: background `#F7F8FA`, surfaces `#FFFFFF`, text `#1F2328`, muted `#656D76`.
  - One accent for buttons, links and XP bars: calm blue `#4C8DFF`.
  - Stat colours (each different from the accent and from status colours): STR warm orange `#F0894B`, INT cyan `#2BB5C8`, WIL violet `#9B7BFF`. Never rely on colour alone — each stat also has its own icon and label.
  - Status colours: success green `#3FB68B`, warning amber `#E3B341`, error red `#E5534B` (error is used only for real errors, never for missed quests — missed is shown in muted grey).
  - Each colour needs a darker variant for text on light backgrounds so everything passes WCAG AA; check every pair.
  - Put all colours in design tokens (CSS variables); no hard-coded colours in components.
- **Type:** "Inter" for all UI, with tabular numbers for XP, levels and timers; "Space Grotesk" only for big display numbers (level, timer). **Bundle the font files with the app** (no Google Fonts link) so it looks right offline. Clear scale: 12/14/16/20/28/40.
- **Layout:** 8px spacing grid, generous whitespace, rounded corners 12–16px, soft shadows only in light mode, thin borders in dark mode.
- **Motion:** subtle (150–250 ms). Quest complete = small check + XP number floats up. Level-up = a short, elegant full-screen moment (~1.5 s, skippable). Respect "reduce motion".
- **Icons:** one consistent set (e.g. Lucide).
- **Accessibility:** WCAG AA contrast, tap targets ≥ 44px, keyboard navigation on desktop, screen-reader labels.
- **Empty states** are friendly and tell me the next action.
- Design an original app icon (simple upward symbol) in all needed sizes.

---

## 9. Platforms and tech stack

One codebase that runs on **phone, laptop and web**:

- **Frontend:** React + TypeScript + Vite, Tailwind CSS (using the design tokens), React Router, Zustand or similar for state, Recharts for charts.
- **Installable PWA** for web + laptop + phone (service worker, offline, manifest, icons).
- **Android app:** wrap with Capacitor, set up from Phase 1 so every phase is tested on Android too. Produce a debug APK build path documented in README. Widgets and the Health Connect bridge need small native (Kotlin) parts — keep them minimal and documented.
- **Notifications:** on Android use Capacitor Local Notifications (reliable, work offline, scheduled ahead for the next 7 days and rescheduled by the day rollover job). On web/laptop, browser notifications are unreliable — show reminders in-app and offer browser notifications only as optional. Say this honestly in Settings.
- **Local-first data:** IndexedDB via Dexie. Call `navigator.storage.persist()` so the browser/OS doesn't clear data. The app must be fully usable offline and without an account. On Android, also write an automatic local backup file weekly.
- **Sync (optional, across devices):** Supabase (Postgres + Auth + Row Level Security) on the free tier. Sync is a layer on top of local data:
  - Records use UUIDs generated on the device; quest instances use deterministic ids — daily: `habit_id + day`; weekly: `quest_id + week_start`; side/recovery: `quest_id` — so the same quest done on two devices is one record.
  - Conflict rule: last-write-wins per record, using a hybrid timestamp (device time + server-received time) so a phone with a wrong clock can't overwrite newer data.
  - `xp_events` are append-only and deduplicated by idempotency key — they never conflict.
  - Soft deletes only (`deleted_at`). Body photos never sync unless I explicitly enable it.
  - After sync, the progress engine recomputes derived values. The `days` record is derived (active, daily clear, shields, streak) and is **recomputed**, never merged by last-write-wins — except `low_energy`, which is my choice and syncs normally.
  - **First sign-in:** local data is uploaded. If I sign in on a device that already has different local data, ask me: merge, keep this device's data, or use the cloud data — and make an automatic export first.
  - Supabase's free tier pauses a project after a period of no activity. Sync must fail gracefully (app keeps working offline, a quiet "Sync paused" note, retry later), and the README explains how to resume the project.
- **Same phone, two installs:** the Android app and the browser PWA keep separate local databases. README should recommend: Android app on the phone, PWA on the laptop, sync between them.
- **App updates:** when a new version is available, show a calm "Update ready — reload" prompt; never reload in the middle of a focus session or a form. Database migrations run before any screen loads.
- **AI proxy:** a small Supabase Edge Function holds the API key and forwards AI requests. This means the **AI coach requires a sync account and internet**; without them the app silently uses the rule engine. Enforce a monthly AI budget limit I set (stop calling the AI when reached), rate-limit requests, and cache weekly-review results.
- **Hosting:** Vercel or Netlify for the web app. Document every deploy step.
- If you believe a different stack is clearly better for this spec, explain why in PLAN.md before using it.

---

## 10. Data model (starting point — refine in PLAN.md)

Design the **complete schema in Phase 1**, even for features built later, so later phases add code, not risky migrations.

- `profile` (name, start_day, display_title)
- `settings` (day_start_hour, week_start, wake_time, wake_window_min, theme, notifications {…}, quiet_hours, ai_enabled, ai_monthly_budget, auto_plan, health_connect_enabled, photo_sync)
- `dreams` (title, why, status: active|paused|done|archived, order, planner_context)
- `main_quests` (dream_id, title, why, stat, target_date, status, planner_context)
- `milestones` (main_quest_id, title, size_weight, target_type: metric|count|manual, target_value, current_source, estimated_weekly_quests, target_date, status, done_at, planner_context, order)
- `habits` (title, stat, difficulty, schedule [weekdays], full_version, min_version, measure: check|minutes|count|steps|sleep_hours, target_value, min_value, core, auto_source [none|steps|sleep|workout|wake_checkin], linked_goal_type/id, skill_ids, status, planned_by: me|rules|ai, order)
- `quests` — weekly, side and recovery quests (type, title, stat, difficulty, measure, target_value, linked_goal_type/id, skill_ids, week_start or due_day, status, planned_by, carried_over_from)
- `quest_instances` (deterministic id, source_type: habit|quest, source_id, day, status: pending|done_full|done_min|done_late|skipped|missed, title_snapshot, difficulty_snapshot, target_snapshot, completed_at, completed_via: tap|widget|health|focus|job_log|notification)
- `progress_entries` (quest_instance_id, source: manual|focus|health_connect|job_log|widget, amount, occurred_at)
- `days` (day, timezone, active, neutral, daily_clear, low_energy, shield_used, shields_after, repaired, streak_at_start, closed_at)
- `focus_sessions` (linked quest_instance_id or stat, skill_ids, planned_min, actual_min, completed, started_at, ended_at, day)
- `body_logs` (day, weight, waist, sleep_hours, steps, workout_notes, photo_ref [local only], source: manual|health_connect)
- `reviews` (type: daily|weekly|monthly|yearly, period, energy, mood, win, lesson, text)
- `xp_events` (day, occurred_at, stat or null, base_amount, reason, idempotency_key UNIQUE, ref_type, ref_id) — append-only **source of truth** for all XP; bonuses and the soft cap are applied when computing (4.8).
- `achievements_unlocked` (achievement_key, unlocked_at) — definitions live in a data file.
- `skills` (branch, name, parent_id, order, manual_level_override) and `skill_evidence` (skill_id, type: session|quest|project, ref_id, minutes, note, link). Skill level 0–5 is **computed** from evidence (thresholds in config), unless I override it.
- `job_applications` (company, role, link, source, applied_at, stage, stage_history [{stage, at}], salary_range, notes, follow_up_at, linked_quest_instance_id)
- `plan_history` (goal_type, goal_id, trigger, summary, changes [{entity, id, before, after}], source: rules|ai, created_at, undone_at) — stores before/after so Undo works exactly.
- `pending_actions` (action, payload, occurred_at [the real tap time], source: widget|notification, processed_at)
- Every table also has: `id` (UUID), `created_at`, `updated_at`, `deleted_at`, `schema_version`. Index everything by `day` where relevant.

---

## 11. Long-term reliability (non-negotiable)

- **Dates:** all "which day is it" logic uses my local timezone and a configurable **day-start hour** (default 4:00 AM, so working past midnight still counts as the same day). Write tests for midnight, day-start, timezone changes and leap years.
- **Missed days:** when I open the app after days away, correctly mark past quests as missed, show a kind welcome-back message, offer a Recovery quest. No crash, no XP loss.
- **Migrations:** versioned schema migrations for IndexedDB and Postgres. Updating the app must never lose data.
- **Backups:** one-tap export to JSON (all data, with app and schema version) and import with validation. Body photos are left out of the JSON by default; a separate "Export with photos" option makes a .zip. Importing onto a device that already has data first makes an automatic export, then asks: replace or merge. Older backup versions must still import after future updates. Automatic weekly local backup (Android) or a reminder (web).
- **Performance:** must stay fast with 10+ years of data (index by date, paginate history, compute summaries efficiently).
- **Security & privacy:** no tracking/analytics by default, RLS on every table, secrets only in env variables, `.env.example` provided.
- **Testing:** unit tests (Vitest) for XP order of operations, level/rank/streak/shield/repair rules, neutral days, Daily Clear on normal and low-energy days, min→full top-up, same-day un-tick correction, idempotency (same action twice = one XP event), day rollover (run late, run twice, after 30 days away, across a timezone change), goal progress, and planner template output. End-to-end tests (Playwright) for: onboarding, complete a quest, low-energy day, level up, focus session linked to a quest (no double XP), goal change → planner → approve → undo, export → wipe → import gives identical progress. Sync tests: two devices completing the same quest offline produce one XP event; two devices each earning XP offline on the same day give the same daily total (with soft cap) as one device would; a completion arriving after the day closed turns a missed day into an active one; focus minutes on one device and manual minutes on another add up.
- **Code quality:** TypeScript strict, ESLint + Prettier, no console errors.
- **Error safety:** a friendly error screen (with "Export my data" and "Reload") instead of a blank page if something crashes; errors are logged locally so I can show them to you.
- **Versioning:** show the app version in Settings; every release gets a CHANGELOG entry.

---

## 12. Build phases (each must be fully working before the next)

1. **Foundation** — project setup, design tokens, bundled fonts, light/dark themes, navigation (5-tab bottom bar + desktop sidebar), the **complete schema** (section 10), the `recordAction` pipeline and event system (6.6), Capacitor Android shell, PWA install, persistent storage, simulation script, developer tools panel (date travel + test data), CLAUDE.md, DECISIONS.md, PROGRESS.md, git repo with first commit.
2. **Core loop** — onboarding (saves first Dream and Main Quest as simple records), habits with full/minimum versions and core flags, Today screen, XP engine, levels, stats, streaks + shields + recovery, day rollover job, low-energy mode, **export/import** (so my data is safe from the first day). *(After this I start using it daily.)*
3. **Goals + Goal Planner (rule-based)** — Vision/Goals screens, milestones, weekly quests, linked progress, interview → plan → preview → approve with templates, automatic weekly generation, Plan history with undo. Runs the planner on the goals saved during onboarding.
4. **Focus & Body** — focus sessions linked to quests, body logs, charts.
5. **Reviews & progress** — daily check-in, weekly/monthly reviews (confirming planner proposals), heatmap, ranks, achievements, titles, level-up/rank-up moments.
6. **Notifications** — wake-up check-in, morning briefing, quest reminders, evening check-in, job follow-ups (Android local notifications + in-app on web), quiet hours.
7. **Sync & accounts** — Supabase auth, sync with the rules in section 9, automatic backups.
8. **Adaptive System + Growth Compass + Ask the System** (replaces the AI coach — section 6.7) — on-device learning, career & health guidance from trusted data, data ownership + compaction, optional scope-locked Gemini layer. Built after Phases 9 and 10.
9. **Career tools** — skill tree and job application tracker, connected to XP, quests, notifications and the Goal Planner.
10. **Android native & polish** — Health Connect auto-tracking, home-screen widgets with the pending-actions queue, app icon/splash, accessibility pass, performance test with 10 years of generated data, final README.
11. **Screen Time** (section 6.8) — phone only: Usage access daily totals per app, 7-day observe week, one suggested entertainment limit, 1-minute reminders when over the limit or after wind-down (never blocking), an automatic lock, a Digital discipline quest and one weekly review line. Off by default.

---

## 13. Definition of done

- Works offline on phone and laptop, installable, and as an Android APK.
- I can use it every day for a month with zero crashes or data loss.
- Every screen looks good at 360px, 768px and 1440px widths in both themes.
- All tests pass; README explains everything a beginner needs.
- `PROGRESS.md` shows every task `[x]`, and the latest code is committed and pushed.

---

## 14. My answers (already decided — don't ask these again; record them in DECISIONS.md)

**Devices:** **Android** phone, **Windows** laptop.

**App:** name **ASCEND**. Sync added later (Phase 7 as planned), start offline. AI coach uses **Claude** (Anthropic API) via the `AIProvider` interface. Body progress photos: **yes, stored on this device only, never synced**.

**Time:** wake time **5:00 AM** (wake-up check-in window 20 min). Day-start hour **3:00 AM**. Week starts Monday. Timezone Asia/Kolkata (auto from device).

**Starter daily quests** (all every day unless I change the schedule):

| Quest | Stat | Difficulty | Measure | Full | Minimum | Core |
|---|---|---|---|---|---|---|
| Wake up on time | WIL | Normal | check (wake check-in) | "I'm up" by 5:20 | late check-in | ✅ |
| AI & Robotics study (phone-free) | INT | Hard | minutes | 150 min | 30 min | ✅ |
| Workout | STR | Normal | check | 30 min workout | 10 push-ups | ✅ |
| Game dev study (phone-free) | INT | Normal | minutes | 60 min | 15 min | |
| Walk | STR | Easy | steps | 8,000 | 3,000 | |
| Sleep | STR | Normal | sleep_hours | 7.5 h | 6.5 h | |
| Journal | WIL | Easy | check | 10 min writing | 3 lines (one win, one lesson) | |
| Meditate | WIL | Easy | minutes | 10 min | 2 min | |

All quests are scheduled **every day, including weekends** (workout too — light days are covered by the minimum).
Expected daily XP when everything is done ≈ 200 before bonuses, which stays under the 300 soft cap — keep this in mind when tuning.

- My career learning time is **3–4 hours a day, split 70% AI & Robotics / 30% game dev** — the two study quests above follow that split. "No-phone deep work" is merged into the study quests: study time is done phone-free (use the focus timer).
- No separate job-application quest for now (job search paused).
- The evening reminder should help me protect sleep: with a 5:00 AM wake and a 7.5 h target, remind me to wind down around 9:00 PM.

**Dream:** Become a **robotics engineer at a top company or research lab** (humanoids / advanced robots).

**Main Quests** (all under that Dream — run the Goal Planner interview for each in Phase 3):
1. **Core robotics skills** — C++, ROS 2, kinematics & control, simulation (stat INT, AI & Robotics track).
2. **Robotics portfolio** — 2–3 strong robotics/AI projects on GitHub (stat INT, AI & Robotics track).
3. **Game dev foundations** — Unreal Engine + C++ (stat INT, game dev track).
4. **MS in AI/Robotics in Germany** — admission via the APS route; the planner should ask me about intake, target universities, IELTS/GRE and APS status to build milestones (stat INT).

**Still ask me** anything else you need before starting (batch your questions, as in section 0).

---

## 15. Future ideas — DO NOT build yet

Know these exist so the architecture leaves room for them, but do not start them until I ask:

- **Yearly Chronicle** — an auto-generated, beautiful year-in-review: levels and ranks gained, best streaks, goals and milestones finished, skills unlocked, focus hours, biggest comeback. Shareable as an image (without private data).
- **Letter to future self** — write a letter that stays locked until a chosen date or a rank-up, then opens with a quiet moment.
- **Laptop screen time** (Phase 11 idea) — a Chrome extension with the same entertainment reminders on the laptop.
- **Accountability partner** (Phase 11 idea) — optionally, a person I choose gets an email if I turn screen-time reminders off during a lock.
- **Voice input** — speak quick notes, journal entries or brain dumps; transcribe and (with AI on) turn them into quests for approval.
