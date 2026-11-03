Read CLAUDE.md, then PROGRESS.md. Check git status.
Replace Phase 8 (LLM AI coach) with a new Phase 8: "Adaptive System + Growth Compass + Ask the System". Record this decision in DECISIONS.md. Free by default; the only external service is Google Gemini's free tier for the optional "Ask the System" layer. Keep the AIProvider interface so Claude can be added later.

BUILD ORDER (so the most valuable parts finish first): Part A → Part B → Part D → Part C.

PART A — Adaptive System (small on-device learning: useful from day 1, improves every day)
Learning
- Cold start: sensible priors + the existing rule engine, so it helps on day 1; show only confident insights at first and reveal more as evidence grows.
- Daily online learning with simple, explainable per-user models (e.g. Beta-Bernoulli completion probability per quest per weekday, recency-weighted moving averages of minutes/sleep/completion, learned best focus hours, learned real weekly capacity).
- Recent data weighs more than old data so it re-adapts after life changes; "reset learning" per habit and overall.
- Learns from my responses: suggestion types I keep rejecting appear less often.
- Make sure all needed data is recorded (add with a safe migration if missing): suggestion events (shown/accepted/edited/rejected/ignored, time, type); notification events (scheduled/delivered/opened, time until related action); app open times; planned vs actual per week.
- It reads numbers and patterns only, never journal/free text. Learning data stays on-device and in my synced account.
Features
- "At risk today": highlight quests I'm most likely to skip.
- "What should I do now?": one best next action from time of day, risk and goal deadlines.
- Adaptive difficulty toward ~80% success (never below minimums).
- Best times for focus and reminders, learned from when I actually complete things.
- Weekly plans and planner proposals sized to my real capacity.
- Goal guidance: forecast milestone and main-quest finish dates from my real pace, warn early when behind, offer catch-up options, suggest this week's focus goal (feeds weekly plan and weekly review).
- Early burnout warning from slipping completion, low-energy days and sleep.
- "What the System knows about you" page in plain words with confidence levels; I can clear any item.

PART B — Growth Compass: a small, focused AI for human development — Career and Health only
- Scope: career discovery, skill development, career roadmaps, physical health, sleep, recovery, nutrition basics and mental wellbeing. Anything else is politely declined.
- Trusted knowledge only, as versioned data files with sources: ESCO and O*NET (careers, skills, interest profiles; O*NET CC BY 4.0 with attribution), official university/DAAD pages, official learning documentation (e.g. ROS 2, Unreal Engine); WHO guidelines (physical activity, sleep, healthy diet), ICMR-NIN Dietary Guidelines for Indians, and recognised sleep/exercise science bodies. No unverified web content. Changeable facts (deadlines, fees, requirements) are marked "check the official site" with the link.

Career pillar
- Career-skill graph: careers → required skills → prerequisite order, mapped onto my skill tree.
- Guided career discovery assessment (interests, strengths, values, e.g. Holland/RIASEC as used by O*NET) suggesting matching careers with explanations. Works for any user.
- Gap analysis vs a chosen career; roadmap of missing skills in prerequisite order, turned into milestones and weekly quests via the Goal Planner (approval first, undoable).
- Include learning roadmaps and guides in the knowledge pack: AI/ML, ROS 2, C++, robotics math, simulation, Unreal Engine; IELTS, GRE, APS/German university process with typical step durations; study science (spaced repetition, deep work, restarting after a break).

Health pillar
- Guided health check-in: activity level, sleep, energy, goals (strength, fat loss, stamina, better sleep, less stress).
- Gap analysis vs WHO guidelines using my real data (workouts, steps, sleep, weight, energy/mood check-ins, low-energy days, Health Connect when available).
- Health roadmap: gradual training progression, sleep routine, simple nutrition habits suited to Indian food, turned into quests via the Goal Planner (approval first, undoable).
- Career–health balance: use Adaptive System insights (e.g. sleep vs next-day completion, heavy study weeks) to balance load and recovery in weekly plans.

Health safety (non-negotiable)
- No diagnosis, medication or treatment advice; pain, injury or illness → "please see a doctor".
- No extreme diets or training; safe weight-change rate only; warn if weight drops too fast.
- Mental wellbeing: supportive, not therapy. If mood check-ins stay very low for a sustained period, gently suggest talking to someone trusted or a professional and show a verified mental health helpline for my country (e.g. Tele-MANAS in India; verify current numbers; configurable for Germany later).
- Health data (sleep, weight, mood/energy, body logs, photos) never leaves the device and my synced account — never sent to any online AI.

For both pillars
- Guidance uses the Adaptive System's real pace to forecast readiness and adjust roadmaps; every recommendation explains why and shows its source. Deterministic, offline, free.

PART C — "Ask the System" (optional, scope-locked language layer; build last)
- An "Ask the System" screen for questions in my own words, answering ONLY career and health/growth questions; off-topic questions are politely declined.
- Uses the AIProvider interface with Gemini's free tier (Google Search grounding where available), via the Supabase Edge Function. Grounded in Growth Compass knowledge and my progress; always shows sources/links.
- May use my goal/skill/quest progress and completion numbers, but never health data, journal text, mood/energy or photos. Show a short note that free-tier questions may be used by Google.
- Can turn an answer into suggested quests or plan items — only applied after my approval, undoable.
- Daily question limit and caching to stay inside the free quota; if over quota, offline or the key is missing, fall back calmly to Growth Compass ("Try again later"), never an error screen. On/off switch in Settings.
- Never ask me to paste the key into chat — give me the exact PowerShell command to set GEMINI_API_KEY as a Supabase secret myself.

PART D — Data ownership and storage (applies to the whole app)
Ownership
- All my data stays with me: on my device and in my own private synced account only. No analytics, no tracking, no selling or sharing, no third parties — except the minimal non-sensitive text sent to Gemini in Part C, and only when I use it.
- The Adaptive System and Growth Compass learn only on-device; nothing about me is used to train any outside model.
- A "My data" screen in Settings shows: what is stored, how much space it uses (device and cloud), what is ever sent outside (and when), plus buttons for full export, compaction (below) and deleting everything.
- "Delete everything": removes all data from this device and from my cloud account (and the account itself, if I choose), after a clear confirmation and an automatic final export.

Compaction — keep a short summary, remove old detail
- When data grows large (show a calm notice above a size threshold), or whenever I choose, I can compact data older than a period I pick (e.g. older than 1 year).
- Compaction first makes an automatic full export (with photos optional) and shows exactly what will be summarised and how much space is saved; nothing happens until I confirm.
- Old detailed records are replaced by compact summaries per week/month, keeping everything that matters long-term:
  - XP per stat and total, levels, ranks, achievements, titles (unchanged — progress must be identical before and after)
  - streak history, active days, Daily Clears, low-energy days, shields used
  - per-quest completion rates (full/min/missed) and total minutes/counts
  - focus hours per stat and per skill; skill levels and evidence counts
  - sleep, steps, weight and waist averages and trends (photos optionally kept or removed)
  - goals, milestones and their completion dates; weekly/monthly/yearly review stats and my written reflections (kept)
  - the Adaptive System's learned parameters, so learning is not lost
- Heatmap, yearly summaries, Profile charts and the Adaptive System keep working from the summaries.
- Compaction is synced so other devices don't re-upload the removed detail; it is recorded in DECISIONS-style history inside the app (date, period, space saved).
- Tests: progress (XP, levels, ranks, streaks, skill levels, days active) is identical before and after compaction; summaries survive export/import and sync; nothing newer than the chosen period is touched.

RULES FOR THE WHOLE PHASE
- Explain every suggestion ("based on your last 6 Mondays…") with confidence. Nothing changes without my approval; everything undoable; at most one suggestion card on Today at a time.
- Never push harder during low-energy streaks, never suggest less sleep.
- Works for any user and any goals — nothing hardcoded to my quests. Onboarding offers generic starter templates by goal type (fitness, study/exams, career/skills, discipline), with my current set as one template.
- On-device parts are deterministic and recomputable from stored data, work with sync, and stay fast with 10 years of data.
- Tests: prediction calibration; simulated users (extend scripts/simulate.ts) showing it improves adherence without oscillating; health safety rules; scope refusal; Ask the System fallback paths; no sensitive data ever sent.
- Keep a clean CSV export of the learning data for a future bigger model.
- I'm using the app daily: never break existing user data.

PROCESS
First write the new SPEC.md section and the Phase 8 task list in PLAN.md and PROGRESS.md (small tasks, section 0.1, in the build order above), then STOP and show me a short summary for approval. After I approve, build the whole phase without stopping between tasks. Only stop if you need something from me (like the Gemini key command), something is broken, the session gets too long, or Phase 8 is finished. At the end, give me one short summary: what's new, bugs fixed, decisions made.
