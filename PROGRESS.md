# PROGRESS.md

## Resume here

- **Current task:** none — 4.4 finished. Next is 4.5. (Phase 3 complete v0.3.0.)
- **Done so far:** Phase 1 complete (v0.1.0) — see the Phase 1 checklist and CHANGELOG. Key code: src/core/time (days), src/core/db (schema), src/core/pipeline (recordAction, defineAction, events), src/config/game.ts, src/core/engine/levels.ts, src/dev (dev tools). Live: https://ascend-vert-mu.vercel.app Phase 2: 2.1 — engine/instances.ts, pipeline/helpers.ts (appDayOf, ensureInstancesForDay), actions/habitSchema.ts + habits.ts (habit.create/update/pause/archive/restore/reorder/delete), RuleError, src/test/testDb.ts helper. 2.2 — engine/xp.ts (baseAward, streakMultiplier, awardKey, liveEvents, computeDayXp, netBaseFor, planAward) + 19 tests; simulate.ts now uses computeDayXp. 2.3 — engine/progress.ts, actions/questCommon.ts (guardDay, applyStatus) + quests.ts (quest.complete, quest.logProgress, quest.wakeCheckin + wakeStatusAt, quest.untick). 2.4 — engine/dayEval.ts (evaluateDay, visibleOnLowEnergy), pipeline/days.ts (refreshDayRecord, called from applyStatus + habit today changes), actions/days.ts (day.setLowEnergy). 2.5 — engine/streaks.ts (computeStreaks → per-day streak fields + summary {streak, longest, daysActive, shields, repairable, lastRepairDay}; repairAllowed; computeHabitStreaks) + 24 tests. 2.6 — pipeline/streaks.ts (refreshStreaks writes streak fields to `days`; called from refreshDayRecord when active/neutral/closed changes and from applyStatus for Recovery quests), actions/rollover.ts (`day.rollover` → RolloverResult {today, closedDays, daysAway, shieldsUsed, streak, recoveryQuestId}), data/recovery.ts, app/rollover.ts (startRollover at startup/resume/day-start timer; latestRollover() for the welcome-back message) + 11 tests. 2.7 — engine/progressState.ts (computeProgress → level, stats, rank, streak, habitStreaks, today XP), actions/progress.ts (`progress.rebuild` consistency check), core/state/progress.ts (Zustand `progressStore`, `useProgress`, `startProgressStore`, `rebuildProgress`); startup order in main.tsx: open DB → consistency check → rollover → progress store → render. Recovery id helpers moved to engine/instances.ts. 2.8 — data/starter.ts (starter quests/dream/main quests, wakeWording, habitFieldsOf), actions/onboarding.ts (`onboarding.complete`, reuses `insertHabit` from habits.ts), core/state/app.ts (`appStore`/`useAppState`: profile + settings; main.tsx applies the stored theme), ui/Field.tsx, ui/stats.tsx (StatChip), features/onboarding/* (OnboardingPage, steps, QuestsStep, draft); App shows onboarding until profile.onboarded_at; e2e smoke tests onboard first; test setup stubs matchMedia. 2.9 — core/state/today.ts (`todayStore`/`useToday`: today's instances + progress, reloads on events), features/today (TodayPage, StatusHeader, QuestCard, WakeCard), ui/ProgressBar, ui/statMeta, ui/hooks (useAction, useNow); wakeStatusAt moved to engine/wake.ts. 2.10 — engine/messages.ts (systemMessage), features/today (SystemMessage, RecoveryCard, useQuestAction, low-energy toggle in TodayPage), ui/XpFloat + ui/hooks/useXpFloat, check-pop/xp-float CSS in index.css, today store adds `lowEnergy` + quest records, app/rollover.ts `welcomeBack(today)`. 2.11 — core/state/habits.ts (`habitsStore`), ui/habit (HabitEditor + habitEdit helpers, shared with onboarding), features/quests (QuestsPage, HabitRow, habitDiff); `/quests` route + `quests` flag on; habit.reorder now emits HabitChanged. 2.12 — features/settings (SettingsPage + sections: Appearance, Day and week, Wake-up, Core quests, Data, About), settings.update validates wake cutoff + rewords wake habits, core/db/open.ts `deleteAllData`. 2.13 — core/backup (format.ts: schema/parse/upgrade, export.ts: buildBackup, reminder.ts), actions/backup.ts (`data.import` replace/merge, `backup.recorded`, `backup.snooze`), progress.ts `rebuildDays` helper, app/files.ts (saveTextFile web/Android, exportBackup), features/backup/ImportPanel, Settings BackupSection, Today BackupReminder, onboarding restore, ErrorScreen export; app store has lastExportAt/backupSnoozeUntil; Capacitor filesystem + share plugins; README backup section. 2.14 — src/dev/generate.ts (`generateHistory`, real actions + simulate model, seeded) + GenerateData panel in DevTools. 2.15 — e2e/core-loop.spec.ts (onboarding, complete quest, low-energy day, export → wipe → import) + e2e/helpers.ts; v0.2.0 (package.json, Android versionName/versionCode), CHANGELOG, README "Using ASCEND day to day". Phase 3: 3.1 — engine/goals.ts (milestoneProgress, mainQuestProgress, dreamProgress), actions/goals.ts (dream/mainQuest/milestone create/update/setStatus, mainQuest.checkIn, goal.saveContext; GoalChanged.meaningful, MilestoneDone). 3.2 — core/state/goals.ts (`goalsStore`, progress maps), features/goals (GoalsPage, MainQuestPage, forms, parts, format); routes /goals and /goals/:id; `goals` flag on. 3.3 — actions/questDefs.ts (quest.create/update/archive, insertQuest, questInstanceId), questCommon `spanOf` + guardDay returns the XP day (weekly: any day of its week; side: any day), applyStatus(xpDay) syncs Quest.status, rollover closes only daily + Recovery, core/state/quests.ts, today store `week`/`side`, features/quests (tabs: DailyTab, QuestDefTabs Weekly/Side, Main tab in QuestsPage, QuestDefForm, questDefValues), Today ThisWeek, QuestChanged event. 3.4 — src/data/planTemplates (shared, study, build, body, index), src/core/planner (types, analyze: analyze/matchTemplate/interviewFor/defaultAnswers/estimateMinutes; plan: planMainQuest/linkedTo/weeklyIdeas/itemList; followups: planMilestoneWeek/planStatusChange/planNextMilestone). Pure, nothing written yet. 3.5 — core/planner/state.ts (loadPlannerState), actions/plans.ts (plan.propose, plan.reject; events PlanProposed/PlanApplied/PlanUndone), goals store has `proposals` + `history`, features/planner (PlannerSheet, QuestionField, PlanItems + itemText, PendingPlan), Re-plan button on MainQuestPage. 3.6 — actions/planApply.ts (`plan.apply`: runs items via other actions' run() inside one tx as source 'planner', resolves `ref:` links, writes plan_history before/after), core/planner/auto.ts (startAutoPlanner/reactToGoalChange: status-change + milestone-week proposals; GoalChanged has `source`), PendingPlan.tsx (ImpactPreview with tick/edit/approve), useAction.runFor, MainQuestPage opens planner on ?plan=new / deadline change, GoalsPage navigates there after creating a main quest; dream cards show their proposals. 3.7 — actions/planUndo.ts (`plan.undo`: reverse-restore, conflict check by hlc, re-creates today's instances, refreshes the day), features/planner/PlanHistory.tsx (PlanHistoryList on GoalsPage + MainQuestPage). 3.8 — planApply `applyProposal` helper, core/planner/weekly.ts (planWeek, runWeeklyPlan; called from app/rollover.ts after each rollover), actions/planWeekly.ts (`plan.weekly`, once per week via meta), rollover `closeOldWeeks` (not_done, no penalty), ThisWeek WeeklyPlanNote with Undo. 3.9 — core/planner/nudges.ts (goalNudges: risk + 30-day check-in), auto.ts handles milestone done (planNextMilestone; auto-applied when settings.auto_plan), features/goals (FollowUps cards, useNudges), Today GoalNudges, Settings PlannerSettings (Auto-plan switch). 3.10 — Today GoalNudges lists unplanned main quests ("needs a plan" → planner), MainQuestPage "Plan this goal" card, e2e/goals.spec.ts; v0.3.0. Phase 4: 4.1 — engine/focus.ts (elapsedMinutes, countedMinutes, unlinkedFocusXp, timerPhase), actions/focus.ts (focus.start / focus.finish; linked → logProgress.run as source 'focus' with occurredAt = started_at; unlinked completed → xp 'focus:<id>'), 'focus' is a delayed source in guardDay; events SessionStarted/SessionFinished. 4.2 — core/state/focus.ts (focusStore: running + past sessions), features/focus (FocusPage setup, FocusRunner full-screen with wake lock / honesty check / "Did you finish?"), focus.finish `counted_min`, /focus route + flag, Today "Start focus" link (Today tests wrapped in MemoryRouter). 4.3 — features/focus/history.ts (weekSummary, byDay, statOf), SessionHistory on FocusPage, focus store `linked` (quest title/stat). No dedicated UI test yet for history — add one in 4.6. 4.4 — actions/body.ts (`body.log`, id body:<day>, feeds today's steps/sleep quests via logProgress), core/state/body.ts, features/body/BodyPage (form + recent table), /body route + flag, BodyLogged event.
- **Next step:** task 4.5 — Body photos: stored on this device only (`photos` table, blob + day; never synced, never in the JSON export), add/view/delete on the Body screen (resize to ~1600px JPEG before saving), link via body_logs.photo_id; Settings → Backup gets "Export with photos" (.zip: backup.json + photos/<day>-<id>.jpg) — needs a small zip writer (check JSZip/fflate availability) and saveTextFile → saveFile(blob).
- **Open questions:** none.
- **Broken:** nothing. `npm run check` passes.

`[ ]` not started · `[~]` in progress · `[x]` done

## Phase 1 — Foundation

- [x] 1.1 Scaffold, tooling, docs, git + GitHub
- [x] 1.2 Design tokens, Tailwind, fonts, themes, contrast test
- [x] 1.3 App shell, navigation, feature flags, error boundary
- [x] 1.4 Time module + tests
- [x] 1.5 Schema + Dexie DB + migrations + persist
- [x] 1.6 Game config + levels/ranks + tests
- [x] 1.7 Action pipeline + event bus + tests
- [x] 1.8 Simulation script + PLAN balance table
- [x] 1.9 PWA + app icon + update prompt
- [x] 1.10 Developer tools panel
- [x] 1.11 Capacitor Android shell + README
- [x] 1.12 Playwright smoke, Vercel deploy, wrap-up

## Phase 2 — Core loop

- [x] 2.1 Habit actions + instance generation
- [x] 2.2 XP engine (also: switch scripts/simulate.ts to the engine's day-total function)
- [x] 2.3 Completion actions
- [x] 2.4 Day evaluation
- [x] 2.5 Streaks, shields, repair
- [x] 2.6 Day rollover + Recovery quest
- [x] 2.7 Derived-state store + rebuild
- [x] 2.8 Onboarding
- [x] 2.9 Today part 1
- [x] 2.10 Today part 2
- [x] 2.11 Quests screen (Daily)
- [x] 2.12 Settings (phase 2)
- [x] 2.13 Export / import
- [x] 2.14 Dev test-data generator
- [x] 2.15 E2E + wrap-up → 1 week of daily use

## Phase 3 — Goals + Goal Planner

- [x] 3.1 Goal actions + progress
- [x] 3.2 Vision & Goals screens
- [x] 3.3 Weekly + side quests
- [x] 3.4 Planner templates + engine
- [x] 3.5 Planner interview UI
- [x] 3.6 Impact preview + approve
- [x] 3.7 Plan history + undo
- [x] 3.8 Weekly generation + auto-apply
- [x] 3.9 Follow-ups
- [ ] 3.10 Onboarding goals planner run + E2E

## Phase 4 — Focus & Body

- [x] 4.1 Focus engine + actions
- [x] 4.2 Focus screen
- [x] 4.3 Session history
- [x] 4.4 Body logs + screen
- [ ] 4.5 Photos + zip export
- [ ] 4.6 Charts + E2E

## Phase 5 — Reviews & progress

- [ ] 5.1 Daily check-in
- [ ] 5.2 Weekly review
- [ ] 5.3 Monthly/yearly summaries
- [ ] 5.4 Profile + heatmap
- [ ] 5.5 Achievements
- [ ] 5.6 Titles
- [ ] 5.7 Level-up / rank-up moments
- [ ] 5.8 Difficulty suggestions + E2E

## Phase 6 — Notifications

- [ ] 6.1 Notification service
- [ ] 6.2 Wake-up check-in
- [ ] 6.3 Briefing, reminders, wind-down
- [ ] 6.4 Quiet hours, pause, rescheduling

## Phase 7 — Sync & accounts

- [ ] 7.1 Supabase schema + RLS
- [ ] 7.2 Auth
- [ ] 7.3 Sync engine
- [ ] 7.4 Days recompute
- [ ] 7.5 First sign-in flow
- [ ] 7.6 Sync paused handling
- [ ] 7.7 Android weekly backup
- [ ] 7.8 Sync tests

## Phase 8 — AI coach

- [ ] 8.1 AIProvider + Edge Function
- [ ] 8.2 Budget, rate limit, cache
- [ ] 8.3 AI Goal Planner
- [ ] 8.4 Auto-plan mode
- [ ] 8.5 Review summary, brain-dump, what now
- [ ] 8.6 Guardrails + tests

## Phase 9 — Career tools

- [ ] 9.1 Skills data + levels
- [ ] 9.2 Skill tree UI
- [ ] 9.3 Job tracker actions
- [ ] 9.4 Jobs list/board + stats
- [ ] 9.5 Follow-ups + planner hooks

## Phase 10 — Android native & polish

- [ ] 10.1 Health Connect
- [ ] 10.2 Widgets
- [ ] 10.3 Pending-actions queue
- [ ] 10.4 Icon/splash
- [ ] 10.5 Accessibility pass
- [ ] 10.6 10-year performance test
- [ ] 10.7 Final README
