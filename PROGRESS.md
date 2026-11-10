# PROGRESS.md

## Resume here

- **Current task:** **production hardening** (Rishi, 2026-11-10) — all 10 phases done (`docs/audit/FINAL-REPORT.md`). **Now: product clarity programme** — UX-1 done locally, see "Product clarity" at the end; see "Production hardening" at the end and `docs/audit/`. **Phase 12 is COMPLETE (v0.12.0, 2026-11-10)** — 12A only: ELEVATE is the only theme (12B–12D dropped by Rishi; the theme picker is hidden, the theme engine stays). Waiting for Rishi's next instruction.
- **Done so far:** Phase 1 complete (v0.1.0) — see the Phase 1 checklist and CHANGELOG. Key code: src/core/time (days), src/core/db (schema), src/core/pipeline (recordAction, defineAction, events), src/config/game.ts, src/core/engine/levels.ts, src/dev (dev tools). Live: https://ascend-vert-mu.vercel.app Phase 2: 2.1 — engine/instances.ts, pipeline/helpers.ts (appDayOf, ensureInstancesForDay), actions/habitSchema.ts + habits.ts (habit.create/update/pause/archive/restore/reorder/delete), RuleError, src/test/testDb.ts helper. 2.2 — engine/xp.ts (baseAward, streakMultiplier, awardKey, liveEvents, computeDayXp, netBaseFor, planAward) + 19 tests; simulate.ts now uses computeDayXp. 2.3 — engine/progress.ts, actions/questCommon.ts (guardDay, applyStatus) + quests.ts (quest.complete, quest.logProgress, quest.wakeCheckin + wakeStatusAt, quest.untick). 2.4 — engine/dayEval.ts (evaluateDay, visibleOnLowEnergy), pipeline/days.ts (refreshDayRecord, called from applyStatus + habit today changes), actions/days.ts (day.setLowEnergy). 2.5 — engine/streaks.ts (computeStreaks → per-day streak fields + summary {streak, longest, daysActive, shields, repairable, lastRepairDay}; repairAllowed; computeHabitStreaks) + 24 tests. 2.6 — pipeline/streaks.ts (refreshStreaks writes streak fields to `days`; called from refreshDayRecord when active/neutral/closed changes and from applyStatus for Recovery quests), actions/rollover.ts (`day.rollover` → RolloverResult {today, closedDays, daysAway, shieldsUsed, streak, recoveryQuestId}), data/recovery.ts, app/rollover.ts (startRollover at startup/resume/day-start timer; latestRollover() for the welcome-back message) + 11 tests. 2.7 — engine/progressState.ts (computeProgress → level, stats, rank, streak, habitStreaks, today XP), actions/progress.ts (`progress.rebuild` consistency check), core/state/progress.ts (Zustand `progressStore`, `useProgress`, `startProgressStore`, `rebuildProgress`); startup order in main.tsx: open DB → consistency check → rollover → progress store → render. Recovery id helpers moved to engine/instances.ts. 2.8 — data/starter.ts (starter quests/dream/main quests, wakeWording, habitFieldsOf), actions/onboarding.ts (`onboarding.complete`, reuses `insertHabit` from habits.ts), core/state/app.ts (`appStore`/`useAppState`: profile + settings; main.tsx applies the stored theme), ui/Field.tsx, ui/stats.tsx (StatChip), features/onboarding/* (OnboardingPage, steps, QuestsStep, draft); App shows onboarding until profile.onboarded_at; e2e smoke tests onboard first; test setup stubs matchMedia. 2.9 — core/state/today.ts (`todayStore`/`useToday`: today's instances + progress, reloads on events), features/today (TodayPage, StatusHeader, QuestCard, WakeCard), ui/ProgressBar, ui/statMeta, ui/hooks (useAction, useNow); wakeStatusAt moved to engine/wake.ts. 2.10 — engine/messages.ts (systemMessage), features/today (SystemMessage, RecoveryCard, useQuestAction, low-energy toggle in TodayPage), ui/XpFloat + ui/hooks/useXpFloat, check-pop/xp-float CSS in index.css, today store adds `lowEnergy` + quest records, app/rollover.ts `welcomeBack(today)`. 2.11 — core/state/habits.ts (`habitsStore`), ui/habit (HabitEditor + habitEdit helpers, shared with onboarding), features/quests (QuestsPage, HabitRow, habitDiff); `/quests` route + `quests` flag on; habit.reorder now emits HabitChanged. 2.12 — features/settings (SettingsPage + sections: Appearance, Day and week, Wake-up, Core quests, Data, About), settings.update validates wake cutoff + rewords wake habits, core/db/open.ts `deleteAllData`. 2.13 — core/backup (format.ts: schema/parse/upgrade, export.ts: buildBackup, reminder.ts), actions/backup.ts (`data.import` replace/merge, `backup.recorded`, `backup.snooze`), progress.ts `rebuildDays` helper, app/files.ts (saveTextFile web/Android, exportBackup), features/backup/ImportPanel, Settings BackupSection, Today BackupReminder, onboarding restore, ErrorScreen export; app store has lastExportAt/backupSnoozeUntil; Capacitor filesystem + share plugins; README backup section. 2.14 — src/dev/generate.ts (`generateHistory`, real actions + simulate model, seeded) + GenerateData panel in DevTools. 2.15 — e2e/core-loop.spec.ts (onboarding, complete quest, low-energy day, export → wipe → import) + e2e/helpers.ts; v0.2.0 (package.json, Android versionName/versionCode), CHANGELOG, README "Using ASCEND day to day". Phase 3: 3.1 — engine/goals.ts (milestoneProgress, mainQuestProgress, dreamProgress), actions/goals.ts (dream/mainQuest/milestone create/update/setStatus, mainQuest.checkIn, goal.saveContext; GoalChanged.meaningful, MilestoneDone). 3.2 — core/state/goals.ts (`goalsStore`, progress maps), features/goals (GoalsPage, MainQuestPage, forms, parts, format); routes /goals and /goals/:id; `goals` flag on. 3.3 — actions/questDefs.ts (quest.create/update/archive, insertQuest, questInstanceId), questCommon `spanOf` + guardDay returns the XP day (weekly: any day of its week; side: any day), applyStatus(xpDay) syncs Quest.status, rollover closes only daily + Recovery, core/state/quests.ts, today store `week`/`side`, features/quests (tabs: DailyTab, QuestDefTabs Weekly/Side, Main tab in QuestsPage, QuestDefForm, questDefValues), Today ThisWeek, QuestChanged event. 3.4 — src/data/planTemplates (shared, study, build, body, index), src/core/planner (types, analyze: analyze/matchTemplate/interviewFor/defaultAnswers/estimateMinutes; plan: planMainQuest/linkedTo/weeklyIdeas/itemList; followups: planMilestoneWeek/planStatusChange/planNextMilestone). Pure, nothing written yet. 3.5 — core/planner/state.ts (loadPlannerState), actions/plans.ts (plan.propose, plan.reject; events PlanProposed/PlanApplied/PlanUndone), goals store has `proposals` + `history`, features/planner (PlannerSheet, QuestionField, PlanItems + itemText, PendingPlan), Re-plan button on MainQuestPage. 3.6 — actions/planApply.ts (`plan.apply`: runs items via other actions' run() inside one tx as source 'planner', resolves `ref:` links, writes plan_history before/after), core/planner/auto.ts (startAutoPlanner/reactToGoalChange: status-change + milestone-week proposals; GoalChanged has `source`), PendingPlan.tsx (ImpactPreview with tick/edit/approve), useAction.runFor, MainQuestPage opens planner on ?plan=new / deadline change, GoalsPage navigates there after creating a main quest; dream cards show their proposals. 3.7 — actions/planUndo.ts (`plan.undo`: reverse-restore, conflict check by hlc, re-creates today's instances, refreshes the day), features/planner/PlanHistory.tsx (PlanHistoryList on GoalsPage + MainQuestPage). 3.8 — planApply `applyProposal` helper, core/planner/weekly.ts (planWeek, runWeeklyPlan; called from app/rollover.ts after each rollover), actions/planWeekly.ts (`plan.weekly`, once per week via meta), rollover `closeOldWeeks` (not_done, no penalty), ThisWeek WeeklyPlanNote with Undo. 3.9 — core/planner/nudges.ts (goalNudges: risk + 30-day check-in), auto.ts handles milestone done (planNextMilestone; auto-applied when settings.auto_plan), features/goals (FollowUps cards, useNudges), Today GoalNudges, Settings PlannerSettings (Auto-plan switch). 3.10 — Today GoalNudges lists unplanned main quests ("needs a plan" → planner), MainQuestPage "Plan this goal" card, e2e/goals.spec.ts; v0.3.0. Phase 4: 4.1 — engine/focus.ts (elapsedMinutes, countedMinutes, unlinkedFocusXp, timerPhase), actions/focus.ts (focus.start / focus.finish; linked → logProgress.run as source 'focus' with occurredAt = started_at; unlinked completed → xp 'focus:<id>'), 'focus' is a delayed source in guardDay; events SessionStarted/SessionFinished. 4.2 — core/state/focus.ts (focusStore: running + past sessions), features/focus (FocusPage setup, FocusRunner full-screen with wake lock / honesty check / "Did you finish?"), focus.finish `counted_min`, /focus route + flag, Today "Start focus" link (Today tests wrapped in MemoryRouter). 4.3 — features/focus/history.ts (weekSummary, byDay, statOf), SessionHistory on FocusPage, focus store `linked` (quest title/stat). No dedicated UI test yet for history — add one in 4.6. 4.4 — actions/body.ts (`body.log`, id body:<day>, feeds today's steps/sleep quests via logProgress), core/state/body.ts, features/body/BodyPage (form + recent table), /body route + flag, BodyLogged event. 4.5 — actions/photos.ts (photo.add / photo.delete / photo.restore), ui/image.ts (resizeImage), features/body/Photos.tsx, body store `photos`, core/backup/zip.ts (makeZip / readZip, fflate), app/files.ts saveFile(blob) + exportWithPhotos, ImportPanel accepts .zip, e2e/photos.spec.ts. 4.6 — src/ui/charts (scale, ChartCard + Tooltip, useWidth, TrendLine, DailyBars), features/body/BodyTrends, features/focus/FocusTrend, SessionHistory test, e2e/focus.spec.ts; v0.4.0. 4.7 — actions/bodySync.ts (bodyLogId, emptyBodyLog, bodyFieldFor, setBodyMetric); quest.logProgress / quest.untick on steps or sleep quests write today's body log; body.log shares today's steps/sleep with every quest that measures them (clear → untick); body_logs added to QUEST_TABLES. Phase 5: 5.1 — actions/reviews.ts (`review.save`, id review:<type>:<period>), core/state/reviews.ts, features/review (ReviewPage, DailyCheckIn), Today CheckInPrompt (evening), /review route + `review` flag, ReviewSaved event. 5.2 — engine/weekStats.ts, progressState `perDay` (xp/active/dailyClear per day), features/review/WeeklyReview (stats, two questions, next week's quests tick/rename → plan.weekly ahead), ReviewPage tabs (?tab=weekly), Today WeeklyReviewPrompt (week's last day); plan.weekly history trigger is now `weekly:<week>`. 5.3 — engine/periodStats.ts (periodRange, periodOf, shiftPeriod, periodStats), perDay gains `streak` + `questsDone` (DaySummary), features/review (PeriodSummary with prev/next + Reflection, Stat, format.ts periodLabel), ReviewPage Monthly/Yearly tabs, Today MonthlyReviewPrompt (in WeeklyReviewPrompt.tsx). 5.4 — engine/profile.ts (weeklyXp, heatmapYear, weakestStat), features/profile (ProfilePage, StatTriangle, Heatmap), /profile route + `profile` flag on; DailyBars ticks never go below 0. 5.4b — actions/carryCleanup.ts (dropCarriedCopies / restoreCarriedCopies, called from applyStatus for weekly quests; history trigger `carry_cleanup:<original id>`), QUEST_TABLES includes plan_history, plan.undo's conflict check compares content (ignoring hlc/updated_at/schema_version) and accepts later still-applied System changes. 5.5 — data/achievements.ts (46 defs: metric ≥ goal, optional feature flag), engine/achievements.ts (computeFacts, achievementProgress), core/achievements (facts.ts readFacts/FACT_TABLES, auto.ts startAchievements debounced on every event), actions/achievements.ts (`achievements.check`, ids ach:<key>, AchievementUnlocked event, source 'system'), core/state/achievements.ts, features/achievements (AchievementToast in Layout, AchievementList on Profile). 5.6 — core/achievements/titles.ts (visibleAchievement, titleName), actions/profile.ts (`profile.setTitle`, ProfileChanged event), features/profile/TitlePicker, title on Profile card + Today StatusHeader. 5.7 — engine/moments.ts (newMoment, mergeSeen), actions/moments.ts (`moments.record`, meta `moments_seen`, emits LevelUp / RankUp), core/state/moments.ts (momentsStore, startMoments watches progressStore; silent after DataImported/DataReset), features/moments/LevelUpMoment (in Layout), `animate-moment-in` CSS. 5.8 — engine/difficulty.ts (difficultySuggestion: low_energy → ease → raise; smallerTarget / largerTarget; SNOOZE_DAYS), actions/difficulty.ts (`difficulty.apply` via applyProposal, trigger `difficulty:<kind>:<day>`; `difficulty.snooze`; meta `difficulty_snooze:<kind>`; SuggestionAnswered event), core/state/suggestion.ts, Today DifficultyCard, e2e/level-up.spec.ts; v0.5.0. Phase 6: 6.1 — core/notifications/types.ts (PlannedNotification, NotificationTap, Notifier), app/notify (android.ts: Capacitor LocalNotifications 8.3.1, channel `ascend`, action type ASCEND_WAKE / `wake_up`, notificationId hash, cancels only `extra.ascend`; browser.ts: timers ≤ 24 h ahead → in-app notice + optional `new Notification`; index.ts getNotifier/setNotifier), core/notifications/taps.ts (handleTap: wake check-in at tap time, action_id `notification:<key>`), core/state/notices.ts, features/notifications/NotificationBridge (taps → navigate; banners above every screen), features/settings/NotificationSettings (honest platform text, permission, browser switch, Send a test), ui/Switch; `notifications` flag (off until 6.4). 6.2 — core/notifications/plan.ts (planNotifications over DAYS_AHEAD = 7, appInstant; wake kind), core/notifications/scheduler.ts (loadPlanInput, startNotificationScheduler: debounced on every event, sync only when the list changed; started in main.tsx behind the flag), Wake-up check-in switch (KINDS list in NotificationSettings). 6.3 — plan.ts briefing (wake end), core reminder (REMINDER_TIME 18:00, only while core open; none on Day 1), wind-down (evening_time → /review, skipped once today's check-in is saved); PlanInput gains `checkInDone` + instance core/source fields; switches + wind-down time in Settings. 6.4 — plan.ts inQuietHours / minuteInQuietHours (wake exempt), welcome_back on day today+7, addMinutes exported; Settings quiet-hours switch + times, "inside quiet hours" warning, week-away text; banners fixed at the top of the viewport; `notifications` flag on; e2e/notifications.spec.ts; v0.6.0. 6.5 — Notifier.exactAlarms / openExactAlarmSettings (plugin check/changeExactNotificationSetting; browser 'unsupported'), showNow honours a future `at` and sync never cancels `kind: 'test'`, scheduler rescheduleAll (forced re-sync), app/device.ts (@capacitor/device 8.0.3 manufacturer), data/batteryGuide.ts (guides + guideFor), features/settings/ReliableReminders (exact timing, brand guide, 2-minute locked test), Today ReminderSetupCard (Android: notifications off / exact timing off → Fix it), Settings Card `id`. Phase 7: 7.1 — supabase/ (config.toml, migrations/20261103000000_sync_records.sql: generic `sync_records` (user_id, tbl, id, hlc, sort_key, deleted, data jsonb, seq), RLS read-own, writes only via `push_records(jsonb)` (security definer, LWW by capped sort_key, xp_events append-only, done beats missed, days by low_energy_set_at) + `reset_my_cloud_data()`), core/sync/merge.ts (SYNCED_TABLES, sortKey, incomingWins — same rules), core/sync/sql.test.ts (runs the migration in PGlite 0.5.10 with a stand-in auth schema; parity with merge.ts); dev deps supabase CLI 2.121.0, @electric-sql/pglite 0.5.10. 7.2 — project linked (ref cyvrymsjizkpvtyqqflu, eu-west-1) and migration applied with `npx supabase db push`; config/cloud.ts (public URL + publishable key, env override, ANDROID_AUTH_REDIRECT `app.ascend.rishi://auth`), core/sync/client.ts (getSupabase/setSupabase, PKCE), app/auth.ts (sendMagicLink, signInWithGoogle — Custom Tab on Android, completeAuthRedirect, startAuthRedirects), core/state/account.ts, features/settings/AccountSection; Android intent-filter for the auth link; @supabase/supabase-js 2.118.0, @capacitor/app 8.1.2, @capacitor/browser 8.0.5; `sync` flag = dev server only until Phase 7 is done. Both sign-ins verified by Rishi on localhost. 7.3 — core/sync/backend.ts (OutRecord/InRecord, SyncBackend, SyncUnavailable reasons offline/paused/auth/server, supabaseBackend: rpc push_records, select by seq, isEmpty, reset), actions/sync.ts (`sync.apply`: LWW via incomingWins, xp_events by idempotency key, days take only low_energy*, skips newer schema, stores pull cursor, DataSynced event; `sync.markPushed`; SYNC_META keys sync:user / sync:pull_seq / sync:push_hlc), core/sync/engine.ts (localChanges by hlc > push mark, pushChanges / pullChanges in batches of 500, syncOnce), test/memoryBackend.ts (MemoryCloud with the same rules + `down`), day.setLowEnergy always stamps low_energy_set_at, openDatabase observes the push mark. 7.4 — `sync.recompute` (actions/sync.ts: numeric instances of touched days re-checked via exported syncStatusWithProgress — status only up, XP day = latest entry day; refreshDayRecord per day incl. closed; refreshStreaks once), called by syncOnce after a pull with changes; moments quiet for 5 s after DataSynced. 7.5 — `sync.link` (meta user, cursor reset, optional clear of synced tables; SyncLinked event), core/sync/link.ts (linkStatus linked/upload/download/choose, connect upload/download/merge/keep_device/use_cloud), core/state/sync.ts (syncStore + startSync runner: sign-in, 5 s after changes, every 5 min, online, visible; choose(); never throws → status), app/localBackup.ts (writeLocalBackup: Android Documents/ASCEND → app folder fallback; web download), features/settings/SyncChoice (backup first, else nothing changes), onboarding "Sign in to bring your data here", main.tsx starts the runner (reload after download / use cloud). 7.6 — runner back-off RETRY_MS 1/5/15/60 min (options.retryMs for tests), `failingSince`, change/interval triggers wait while failing; features/settings (SyncStatusLine + syncText: syncedAgo, syncStatusText; Sync now), Today SyncPausedNote (> 24 h failing), README "Sync between your phone and laptop" (paused project → Restore project → Sync now; db push). 7.7 — app/localBackup.ts runWeeklyLocalBackup (Android, onboarded, ≥ 6.5 days since meta local_backup_at; writes ascend-weekly-<date>.json, keeps newest KEEP_WEEKLY = 4), `backup.localSaved` action (meta local_backup_at / local_backup_path), app store localBackupAt/Path, Settings → Backup line, started after rollover in main.tsx. 7.8 — core/sync/spec11.test.ts (the four SPEC 11 sync tests), sync.apply: records already pushed (hlc ≤ push mark) take the server's copy, observeHlc(sort_key); migration 20261103010000_instance_merge.sql + merge.ts: quest_instances by award_revision, then progress rank, then time (applied to the live project); `sync` flag on; e2e/account.spec.ts; v0.7.0. 6.6 — data/batteryGuide.ts `nothing` guide. 7.9 — npm audit review (no changes). Phase 9: 9.1 — Skill gets `track` (SkillTrack), QuestInstance optional `skill_ids_snapshot` (habitSnapshot/refreshedSnapshot), GAME.skills (levelHours, levelProjects, questCreditMinutes, balanceTarget), data/skills.ts (SKILL_SEED, seedSkillId, TRACK_LABEL), engine/skills.ts (levelFor, skillContributions, skillProgress, trackBalance, projectTitle/projectNote), actions/skills.ts (skills.seed with SEED_HLC, skill.create/update/move/archive/delete/updateBranch/addProject/deleteProject; SkillChanged event), quest.create/update accept skill_ids, main.tsx seeds behind the `skills` flag (still off). 9.2 — core/state/skills.ts (skillsStore, groupBranches, readSkillInput reads only skill-carrying rows, startSkills debounced on relevant events), features/skills (SkillsPage + levelRules, BalanceCard + balanceNote, SkillTree + LevelPips, SkillSheet + SkillEditor, SkillForms: AddSkillForm / BranchForm / ProjectForm, format.ts), /skills route, startSkills in main.tsx behind the flag. 9.2b — ui/SkillPicker.tsx (in ui/habit/HabitEditor when `skill_ids` is set, QuestDefForm, FocusPage → focus.start skill_ids), EditableHabit/QuestDefValues `skill_ids`, habitDiff compares skill_ids, planner carry-over keeps skill_ids; `skills` flag on. 9.3 — actions/jobs.ts (job.create/update/setStage/delete, JOB_STAGES, FOLLOW_UP_DAYS = 7, CLOSED_STAGES, applicationQuestId/interviewQuestId `job:<id>:applied|interview`, isApplyQuest; JobChanged event), insertQuest takes an optional fixed id. 9.4 — config/features.ts isAvailable(key, settings) (jobs also needs settings.jobs_enabled; used by secondaryNav(settings), achievements check/list, titles visibleAchievement/titleName(key, settings)), engine/jobs.ts (jobStats, dropStageOf, followUpsDue, WEEKS_SHOWN = 8), core/state/jobs.ts, features/jobs (JobsPage list + board, JobCard with Stage select, JobForm add/edit/delete, JobStats, labels.ts), features/settings/JobsSettings.tsx, /jobs route, `jobs` flag on. 9.5 — notifications kind `job_followup` (plan.ts FOLLOW_UP_TIME 10:00, PlanInput.followUps + settings.jobs_enabled; scheduler reads job_applications; NotificationSettings switch when jobs on), actions job.followedUp / job.snoozeSuggestion (meta `job_suggestion_snooze:<kind>`, 14 days), jobs store `snoozed`, features/jobs FollowUpsCard (on Today) + JobSuggestionCard (on Jobs), core/planner/jobs.ts (jobSuggestion, applicationCount), PlannerState.jobStats (loadPlannerState when jobs on), planWeek adds the suggestion to an active job-search goal, plan items may carry measure/target_value. 9.6 — e2e/career.spec.ts, README (Skills, Jobs), CHANGELOG 0.8.0, version 0.8.0 (Android versionCode 8). Phase 10: 10.1 — @capgo/capacitor-health 8.11.12, minSdk 26, manifest keeps only READ_STEPS/SLEEP/EXERCISE (others tools:node=remove), public/privacypolicy.html, core/health (readings.ts: sleepHoursFor, workoutMinutesFor, workoutVersion; source.ts HealthSource; runner.ts healthStore, readDay, readHealthNow, startHealthReader 15 min + resume), app/health.ts (healthConnect), actions/health.ts (`health.apply`, source health), features/settings/HealthSettings.tsx, `health` flag on. APK builds with JAVA_HOME=C:/Users/rishi/.jdks/jbr-21.0.11 (Android Studio's jbr is Java 25 now). 10.2–10.3 (one commit) — core/widget (snapshot.ts buildSnapshot, bridge.ts WidgetBridge/PendingTap, writer.ts startWidgetWriter), core/pending/queue.ts processPending, actions/pending.ts (pending.enqueue, pending.markProcessed, WIDGET_ACTIONS), app/widgetBridge.ts (registerPlugin WidgetBridge), app/DeepLinks.tsx (app.ascend.rishi://open/<path>), notification kind `widget` for refused taps, main.tsx runs the queue before rollover + on resume, `widgets` flag on; Java: WidgetStore, WidgetBridgePlugin (registered in MainActivity), AscendWidget(+Small/Medium), res/layout/widget_ascend.xml, res/xml/widget__\_info.xml, res/values/widget.xml, manifest receivers + open intent-filter. progressValue ties broken by hlc; vitest testTimeout 15 s. 10.4 — res/drawable/ic_ascend_symbol.xml (splash icon + monochrome layer in mipmap-anydpi-v26/ic_launcher_.xml, re-added by scripts/android-assets.ts), ic_stat_ascend.xml + capacitor.config.ts LocalNotifications smallIcon/iconColor, styles.xml windowSplashScreen*. 10.5 — e2e/a11y.spec.ts (axe WCAG 2.1 AA + 44px targets, all screens, light/dark, phone/laptop), ui/Switch 44px tap area, ui/hooks/useDialog (SkillSheet, PlannerSheet, Photos → PhotoViewer), skill node names, widget rows 44dp (small 2 rows 4x2, medium 4 rows 4x4). 10.6 — src/perf (tenYears.ts generateTenYears, tenYears.perf.ts budgets), vitest.perf.config.ts, `npm run perf`; refreshDayRecord(..., { deferStreaks }) used by rollover closeDay + rebuildDays (streaks once at the end). 10.7 — README (Android extras, PowerShell install, Java 21), CHANGELOG 0.9.0, version 0.9.0 (versionCode 9). Phase 8: 8.1 — db/types/learning.ts (LearningEvent, Summary, Compaction), Dexie version(2) STORES_V2 (DB_VERSION 2; SCHEMA_VERSION stays 1), SYNCED_TABLES + V2_TABLES, migration 20261104000000_phase8_tables.sql (+ sync_server_version()), backend.serverVersion(), engine V2Mode skip/all/new + meta sync:server_v2 (`sync.markServerV2`), MemoryCloud.version. 8.2 — core/adaptive/record.ts (writeLearning, planSuggestionType), actions/learning.ts (learning.shown / answer / appOpen / closeDays), outcomes recorded in plan.apply/reject/undo, difficulty.apply/snooze, job.snoozeSuggestion, mainQuest.checkIn (PLAN_TABLES now includes learning_events), ui/hooks/useShown.ts (useShown, recordAnswer) on DifficultyCard, PendingPlan, goals FollowUps (risk/check-in), JobSuggestionCard; app/learning.ts startLearningRecorder in main.tsx. 8.3 — actions/learningWeeks.ts (learning.notificationsPlanned / notification / closeWeeks, weekNumbers, minutes_to_action), Notifier.onDelivered (android localNotificationReceived, browser banners), taps.ts LEARNED_KINDS + opened, scheduler records the plan after each real sync, NotificationBridge records delivered. 8.4 — core/adaptive/model.ts (ADAPTIVE consts, recencyWeight, betaEstimate, recencyAverage, recentChange, brier, Confidence), input.ts (AdaptiveInput, InstanceObs, loadAdaptiveInput, learnFrom resets, forgotten), habits.ts (HabitModel, habitModel/habitModels, overallPrior, chanceOn, weekdayCount), test/adaptiveInput.ts (rng, testHabit/Instance/Event/Input, pastDays). 8.5 — adaptive/patterns.ts (focusWindow, completionWindow, weeklyCapacity, suggestionWelcome, mayShow, MAX_GAP_DAYS); FocusObs.linked. 8.6 — adaptive/today.ts (atRiskToday, whatNow, PendingQuest, RISK_BELOW, MAX_RISKS), core/state/adaptive.ts (adaptiveStore, computeAdaptive, startAdaptive debounced 1.5 s, started in main.tsx), features/today: useAdaptiveToday, WhatNow, SuggestionSlot (one card; `extra` candidates first), suggestionHooks.ts (useDifficultyVisible, useGoalNudgeRows), QuestCard `risk` prop. 8.7 — engine/difficulty.ts rewritten (DIFFICULTY aim 0.8, ease <0.65 after 7 days at current target, raise >0.92 after 14, max 2 eased, no raise in low-energy streak, never sleep; HabitChange.fullDays/days; changeReason), state/suggestion.ts derives from adaptiveStore (start after startAdaptive), difficulty.apply accepts fullDays/days, DifficultyCard wording + numbers. 8.8 — settings notifications.reminder_time (optional; plan.ts reminderTimeOf), adaptive/timing.ts reminderSuggestion, completionWindow(coreOnly) + InstanceObs.wake + window tie-break, learning.answer `values`, features/today ReminderTimeCard + useReminderCard (in SuggestionSlot), planner: PlannerState.capacity (loadPlannerState reads 56 days), knownCapacity, Analysis.capacityRatio, weeklyCount(…, capacityRatio), weekly.ts weeklyLimit, plan load check uses capacity. 8.9 — adaptive/goals.ts (milestoneStart, milestoneForecast, mainQuestForecast, behindMessage, focusGoalOfWeek, BEHIND_DAYS), nudges.ts uses forecasts for early risk (shared milestoneStart), goals store `forecasts` + `focusGoal`, PlannerState.focusGoalId (from goalsStore) → planWeek puts focus goal first, features/goals/ForecastLine.tsx (ForecastLine, FocusGoalLine) on MainQuestPage, ThisWeek, WeeklyReview. 8.10 — adaptive/burnout.ts (burnoutWarning: slipping / low_energy / short_sleep / low_energy_checkins, 2+ signals), actions/burnout.ts (`adaptive.lighterWeek`, trigger burnout:<day>, plan path), features/today BurnoutCard + useBurnoutCard (first in SuggestionSlot, rests 14 days). 8.11 — actions learning.reset / learning.forget + LearningChanged event (also from learning.answer), input.ts learnSince(key), patterns/burnout honour cleared keys (focus_window, completion_window, core_window, capacity, welcome:<type>, sleep, energy), adaptive/knows.ts (knownItems, learningEventsCsv, dailyOutcomesCsv), features/knows/KnowsPage.tsx at /knows (flag `adaptive`), Profile link. 8.12 — adaptive/simulateAdaptive.ts (simulateUser, simUsers, simulateAdaptive), simulate.ts adaptive table, difficulty hysteresis (targetHistory: ease to last worked target, raise capped below a recently failed one, raiseCooldownDays 42), adaptive/load.ts split from pure input.ts (loadAdaptiveInput moved). Part A done. 8.13 — data/compass (schema.ts Zod pack schema, sources.ts SOURCES + ONET_ATTRIBUTION, index.ts PACK_INPUT v2026.11.1, careers/skills/roadmaps/health placeholders), core/compass/pack.ts (pack, packProblems, by-id helpers, onetUrl), core/compass/scope.ts (classifyScope, OFF_TOPIC_REPLY). 8.14 — data/compass/skills.ts (~110 skills), careersTech.ts / careersEngineering.ts / careersOther.ts (89 careers, 8 deep) aggregated in careers.ts, core/compass/careers.ts (learningOrder, careerSkillGraph, matchSkillTree, careersIn). 8.15 — data/compass/roadmapsSkills.ts (6) + roadmapsProcess.ts (6) → roadmaps.ts; sources german-missions-india, ophir-2009, ward-2017. 8.16 — data/compass/discovery.ts (RIASEC_NAMES, INTEREST_ITEMS, STRENGTHS, VALUES), core/compass/discovery.ts (interestProfile, topTypes, matchCareers, discoveryReady), Profile.compass (CompassProfile: discovery, target_career, health), actions/compass.ts (compass.saveDiscovery, compass.setTarget), features/compass/Discovery.tsx (not mounted until 8.21). 8.17 — core/compass/gap.ts (careerGap, careerPlanItems, DEFAULT_WEEKLY_HOURS), features/compass/CareerGap.tsx (gap list, readiness, Turn into a plan → dream/mainQuest create + plan.propose trigger career:<id> → /goals/<id>). 8.18 — data/compass/health.ts (9 guidelines, HELPLINES IN Tele-MANAS verified:null), helpline `verified` nullable, core/compass/safety.ts (helplineFor, countryFromTimeZone, helplineText, safetyReply, maxSafeLossPerWeek, earliestSafeDate, weightDropWarning, lowMoodSupport, sleepChangeAllowed). 8.19 — AdaptiveInput.steps + InstanceObs.workout, core/compass/health.ts (HEALTH_GOALS, HealthCheckIn, healthGap), compass.saveHealth, features/compass/HealthCheck.tsx. 8.20 — core/compass/healthPlan.ts (healthPlanItems), features/compass/HealthPlan.tsx (in HealthCheck), adaptive/balance.ts (balanceSignal, sleepInsight), PlannerState.balance → planWeek recovery quest + one step fewer. 8.21 — features/compass/CompassPage.tsx (tabs career/health), Roadmaps.tsx, CareerBrowser.tsx, route /compass + nav item + flag `compass`; e2e a11y includes /knows, /compass, /compass?tab=health. 8.22 — data/starterTemplates.ts (STARTER_TEMPLATES ×5, DEFAULT_TEMPLATE), onboarding draft.template + applyTemplate, QuestsStep 'Start from' chips. Part B done. 8.23 — migration my_cloud_usage(), SyncBackend.cloudUsage (supabase + MemoryCloud), core/data/usage.ts (DATA_GROUPS, localUsage, deviceEstimate, formatBytes), core/data/outbound.ts + `outbound.record` (actions/myData.ts), features/settings/MyDataPage.tsx at /my-data (linked from Data card), e2e a11y /my-data. 8.24 — supabase/functions/delete-account (Deno, service role in function), core/data/deleteEverything.ts (export → cloud reset → account → wipe), features/settings/DeleteEverything.tsx on My data; eslint ignores supabase/functions. 8.25 — core/compaction/summaries.ts (MonthSummary v1, SlimInstance/SlimSession, buildSummaries, compactable (not Recovery), expandSummaries), ProgressInput.compactedXp. 8.26 — core/compaction/expanded.ts (loadExpanded cached, compactedBefore), core/compaction/apply.ts (COMPACTION_TABLES, monthStart, planCompaction, applyCompaction, mergeMonth), loaders merged (state/progress, achievements/facts + FACT_TABLES summaries + FactsInput.extraBodyDays, state/skills readSkillInput, state/goals, state/focus), refreshDayRecord + rebuildDays skip days < compactedBefore, recordAction adds 'compactions' to every tx; apply.test.ts invariant. 8.27 — actions/compact.ts (data.compact MIN_AGE_DAYS 365, data.compactLocal, removeCompactedDetail also run by data.import), DataCompacted event, migration 20261104020000_compaction_purge.sql (compact_my_records), SyncBackend.purgeCompacted, engine: compactLocal after pulls + purgeCloud (meta sync:purged_cutoff, `sync.markPurged`), compact.test.ts end to end. 8.28 — features/settings/Compaction.tsx (years 1/2/3, photos keep/remove, preview via planCompaction, export first, history, SIZE_NOTICE_BYTES 25 MB) on My data. Part D done. 8.29 — core/ask/provider.ts (AIProvider, AskRequest/Answer/Result, geminiProvider via functions.invoke('ask')), supabase/functions/ask (Gemini + google_search, scope prompt, QUESTS parsing, cache 7 d, ask_take 20/day), migration 20261104030000_ask_the_system.sql. 8.30 — core/ask/context.ts (ALLOWED_KEYS, buildAskContext), core/ask/ask.ts (askTheSystem gates, compassHints, DEFAULT_DAILY_LIMIT 10, fallback texts). 8.31 — features/ask/AskPage.tsx + useAskDeps.ts at /ask (flag `ask`, nav 'Ask'), features/settings/AskSettings.tsx, a11y /ask. 8.32 — e2e/phase8.spec.ts, README (Phase 8 usage + server setup), CHANGELOG 0.10.0, version 0.10.0 / versionCode 10. Phase 8 done.
- **Next step:** none — wait for Rishi (and the results of the 12A phone checklist). Checks: this laptop is low on memory and background runs get killed when idle — run `npm run typecheck`, `lint`, `format:check`, then vitest in three FOREGROUND chunks with `--maxWorkers=1` (src/core/pipeline+engine+db; rest of src/core; everything outside src/core), each gated on its own exit code, then commit. Never gate a commit on `grep` output. Helpers in the session scratchpad (tick.cjs etc.) are not in the repo. Android builds need JAVA_HOME=C:/Users/rishi/.jdks/jbr-21.0.11.
- **Open questions:** results of the 12A phone checklist.
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
- [x] 4.5 Photos + zip export
- [x] 4.6 Charts + E2E
- [x] 4.7 Steps & sleep: one source of truth (Rishi's change)

## Phase 5 — Reviews & progress

- [x] 5.1 Daily check-in
- [x] 5.2 Weekly review
- [x] 5.3 Monthly/yearly summaries
- [x] 5.4 Profile + heatmap
- [x] 5.4b Finished quest → drop its carried copy next week (Rishi's change)
- [x] 5.5 Achievements
- [x] 5.6 Titles
- [x] 5.7 Level-up / rank-up moments
- [x] 5.8 Difficulty suggestions + E2E

## Phase 6 — Notifications

- [x] 6.1 Notification service
- [x] 6.2 Wake-up check-in
- [x] 6.3 Briefing, reminders, wind-down
- [x] 6.4 Quiet hours, pause, rescheduling
- [x] 6.5 Exact alarms + battery-optimization guide (Rishi's request)
- [x] 6.6 Nothing Phone battery guide (Rishi's request)

## Phase 7 — Sync & accounts

- [x] 7.1 Supabase schema + RLS
- [x] 7.2 Auth
- [x] 7.3 Sync engine
- [x] 7.4 Days recompute
- [x] 7.5 First sign-in flow
- [x] 7.6 Sync paused handling
- [x] 7.7 Android weekly backup
- [x] 7.8 Sync tests
- [x] 7.9 npm audit review (Rishi's request)

## Phase 8 — Adaptive System + Growth Compass + Ask the System

Part A — Adaptive System

- [x] 8.1 Schema v2 (learning_events, summaries, compactions) + upgrade
- [x] 8.2 Recording I: suggestions + app opens
- [x] 8.3 Recording II: notifications + week planned vs actual
- [x] 8.4 Adaptive core models + calibration
- [x] 8.5 Best hours, capacity, acceptance weights
- [x] 8.6 Today suggestion slot, at risk today, what now
- [x] 8.7 Adaptive difficulty (~80%)
- [x] 8.8 Best times + capacity-sized plans
- [x] 8.9 Goal guidance + focus goal of the week
- [x] 8.10 Burnout early warning
- [x] 8.11 "What the System knows" page, resets, CSV
- [x] 8.12 Simulated adaptive users + Part A wrap-up

Part B — Growth Compass

- [x] 8.13 Knowledge pack format + scope classifier
- [x] 8.14 Career data + skill graph
- [x] 8.15 Learning roadmaps + guides
- [x] 8.16 Career discovery assessment
- [x] 8.17 Career gap analysis → roadmap → planner
- [x] 8.18 Health knowledge + safety engine
- [x] 8.19 Health check-in + WHO gap analysis
- [x] 8.20 Health roadmap + career–health balance
- [x] 8.21 Compass screen
- [x] 8.22 Onboarding starter templates by goal type

Part D — Data ownership and storage

- [x] 8.23 My data screen
- [x] 8.24 Delete everything
- [x] 8.25 Compaction summaries builder
- [x] 8.26 Engines read summaries
- [x] 8.27 Compaction action + sync
- [x] 8.28 Size notice + compaction UI

Part C — Ask the System

- [x] 8.29 AIProvider + Gemini Edge Function
- [x] 8.30 Context builder, scope gate, fallback
- [x] 8.31 Ask the System screen
- [x] 8.32 Phase 8 wrap-up (E2E, README, v0.10.0)

## Phase 9 — Career tools

- [x] 9.1 Skills data + levels
- [x] 9.2 Skill tree UI
- [x] 9.2b Skill pickers (focus, daily, weekly/side) + Skills switched on
- [x] 9.3 Job tracker actions
- [x] 9.4 Jobs list/board + stats
- [x] 9.5 Follow-ups + planner hooks
- [x] 9.6 Phase 9 wrap-up (E2E, README, v0.8.0)

## Phase 10 — Android native & polish

- [x] 10.1 Health Connect
- [x] 10.2 Widgets
- [x] 10.3 Pending-actions queue
- [x] 10.4 Icon/splash
- [x] 10.5 Accessibility pass
- [x] 10.6 10-year performance test
- [x] 10.7 Final README

## Phase 11 — Screen Time

- [x] 11.1 Schema v3
- [x] 11.2 Entertainment app list
- [x] 11.3 Lock rules
- [x] 11.4 Screen-time actions
- [x] 11.5 Reminder engine
- [x] 11.6 Android native I
- [x] 11.7 Android native II
- [x] 11.8 Integrity
- [x] 11.9 Setup + UI
- [x] 11.10 "Digital discipline" daily quest
- [x] 11.11 Privacy + data
- [x] 11.12 Phase 11 wrap-up

## Phase 12 — Redesign + switchable themes

12A — theme engine + ELEVATE everywhere

- [x] 12A.1 Redesign inventory
- [x] 12A.2 Theme engine
- [x] 12A.3 Settings fields
- [x] 12A.4 Fonts
- [x] 12A.5 UI primitives in the theme language
- [x] 12A.6 Navigation shell
- [x] 12A.7 Growth screen with tabs
- [x] 12A.8 Me screen with tabs
- [x] 12A.9 System companion robot
- [x] 12A.10 Ask
- [x] 12A.11 Today dashboard
- [x] 12A.12 Today cards in ELEVATE
- [x] 12A.13 Quests screen
- [x] 12A.14 Focus
- [x] 12A.15 Growth → Goals
- [x] 12A.16 Growth → Roadmap
- [x] 12A.17 Growth → Skills
- [x] 12A.18 Me → Stats & achievements
- [x] 12A.19 Me → Body
- [x] 12A.20 Settings
- [x] 12A.21 System surfaces
- [x] 12A.22 VFX engine
- [x] 12A.23 ELEVATE level-up and rank-up moments
- [x] 12A.24 Optional sound + haptics
- [x] 12A.25 Android
- [x] 12A.26 Desktop layout pass
- [x] 12A.27 Quality
- [x] 12A.28 12A wrap-up

**12A phone checklist** (Nothing Phone (3a), install the 0.12.0 APK — README “Install on your phone”):

1. Start the app: black splash with the lime chevron, then Today with no flash; status and navigation bars black with light icons.
2. Bottom bar: Today · Quests · Focus (big lime centre button) · Growth · Me; the active item sits in a white circle; nothing hides behind the bar or the robot Ask button.
3. Today: Day / level / XP bar header, Today’s quests tile (count + next quest), Body / Skills / Roadmap (/ Screen time) tiles each open their screen; chips filter the list.
4. Finish a quest with Full: lime outline, +XP float with a small burst; do a Minimum, then Upgrade to Full: a bigger burst.
5. Finish every daily quest (or use Low energy): the lime “Daily Clear” banner with the happy robot drops in and goes.
6. Level up (dev tools or real XP): full-screen “You’ve reached Level N”, moving shapes, swoosh, 2×2 reward grid, white CONTINUE pill closes it.
7. Settings (Me → gear) → Appearance: Effects Light (smaller effects) and Off (no movement, same information); turn on Sound and vibration: a soft tone and a short buzz on the next quest.
8. Growth (Goals / Roadmap / Skills / Jobs) and Me (Stats / Body / Reviews, Screen time, What the System knows) tabs all open; old notification taps still land on the right screen.
9. Home-screen widgets (small and medium): black with lime bar and actions; “Done?” still works.
10. Turn the phone sideways / try the laptop: sidebar with the lime player tile, two-column Today, Focus and Stats.

Phase 12 is complete after 12A — ELEVATE is the only theme (12B–12D dropped, Rishi 2026-11-10; see DECISIONS).

## Redesign inventory (Phase 12 — ELEVATE, the only theme)

Every route, tab, sheet, dialog, card, banner, toast, state and Android surface, from the codebase (task 12A.1). An item is ticked only when it is fully redesigned in the current theme (tokens + the theme's layout language; real data; 360 / 768 / 1440 checked). (Only ELEVATE is built; were another theme ever added, the list would be re-ticked for it.)

**Shell and navigation** (`app/`)

- [x] Layout: bottom bar Today · Quests · Focus (centre) · Growth · Me (`app/Layout.tsx`)
- [x] Layout: desktop sidebar (≥1024 px)
- [x] More page removed; `/more` and every old address redirect (`features/more/MorePage.tsx`, `app/routes.tsx`)
- [x] Deep links (`app/DeepLinks.tsx`, `app/deepLink.ts`) → new routes
- [x] Notification taps (`features/notifications/NotificationBridge.tsx`) → new routes
- [x] Ask floating button (every main screen) + Ask bottom sheet (screen context, suggested questions, typed question, answer, sources, fallback, privacy note)
- [x] System companion robot (System message, level-up/rank-up, empty states, onboarding)

**Today** (`features/today/`)

- [x] Dashboard header: name, title, day, level, XP bar, rank, streak (`StatusHeader.tsx`)
- [x] Filter chips All / Core / Body / Mind / Career
- [x] Today’s quests tile (progress + next quest)
- [x] Live tiles: Body (sleep, steps), Skill (current skill, hours this week), Roadmap (next step, readiness %), Screen time (today vs limit), check-in / review tile when due
- [x] Quest card — check (Full / Minimum / Upgrade), numbers (minutes/count/steps/sleep input), weekly/side "Done", auto (Digital discipline), done/missed states, undo, XP float (`QuestCard.tsx`, `ui/XpFloat.tsx`)
- [x] Wake-up card "I'm up" (early / on time / late / window closed) (`WakeCard.tsx`)
- [x] Low-energy toggle + hidden-quests note (`TodayPage.tsx`)
- [x] Recovery quest card (`RecoveryCard.tsx`)
- [x] System message line (`SystemMessage.tsx`) incl. welcome back
- [x] "Now:" line (`WhatNow.tsx`) and at-risk marks
- [x] Suggestion slot: difficulty card, burnout card, reminder-time card, goal nudges (behind schedule, 30-day check-in, needs a plan), job suggestion (`SuggestionSlot.tsx`, `DifficultyCard.tsx`, `BurnoutCard.tsx`, `ReminderTimeCard.tsx`, `GoalNudges.tsx`, `jobs/JobSuggestionCard.tsx`)
- [x] Reminder setup card (`ReminderSetupCard.tsx`)
- [x] Sync paused note (`SyncPausedNote.tsx`)
- [x] Job follow-ups card (`jobs/FollowUpsCard.tsx`)
- [x] Weekly / monthly review prompts (`WeeklyReviewPrompt.tsx`), check-in prompt (`CheckInPrompt.tsx`)
- [x] Backup reminder (`BackupReminder.tsx`)
- [x] This week (weekly quests on Today) (`ThisWeek.tsx`)
- [x] Screen time: observe note, suggestion card (Accept / Edit + LimitEditor), Today card, incident banner (`screentime/ScreenTimeCard.tsx`, `LimitEditor.tsx`)
- [x] Start focus button; empty states (no quests today, Day 1)

**Quests** (`features/quests/`, `ui/habit/`)

- [x] Quests page header + tabs Daily / Weekly / Main / Side (`QuestsPage.tsx`, `QuestDefTabs.tsx`)
- [x] Daily tab list, core star, streaks, paused / archived sections (`DailyTab.tsx`, `HabitRow.tsx`)
- [x] Habit editor (title, stat, difficulty, measure, target, minimum, full/min wording, days, skills) + new / edit / reorder / pause / archive / restore / delete-forever confirm (`ui/habit/HabitEditor.tsx`, `HabitRow.tsx`)
- [x] Weekly / side quest form (`QuestDefForm.tsx`) and lists, done / carried-over states
- [x] Skill picker (`ui/SkillPicker.tsx`)
- [x] Empty states per tab

**Focus** (`features/focus/`)

- [x] Setup: quest/stat choice, presets 25/5 · 50/10, skills, Start (`FocusPage.tsx`)
- [x] Running timer ring, full-screen mode, face-down check, End early confirm, "Did you finish?" (`FocusRunner.tsx`)
- [x] This week summary + session history by day (`SessionHistory.tsx`)
- [x] Focus trend chart (`FocusTrend.tsx`)

**Growth → Goals** (`features/goals/`, `features/planner/`)

- [x] Growth screen with tabs Goals · Roadmap · Skills · Jobs (when on)
- [x] Vision: dreams, why, progress, main quests, archived (`GoalsPage.tsx`)
- [x] Main quest page: why panel, milestones, progress, forecast line, focus goal of the week, edit / pause / done confirm / archive / restore (`MainQuestPage.tsx`, `parts.tsx`, `ForecastLine.tsx`)
- [x] Goal / milestone forms (`forms.tsx`)
- [x] Follow-ups: deadline risk options, 30-day check-in (`FollowUps.tsx`)
- [x] Goal Planner sheet: analysis, interview questions, preview / approve items, edits (`PlannerSheet.tsx`, `QuestionField.tsx`, `PlanItems.tsx`)
- [x] Pending plan card (`PendingPlan.tsx`) and Plan history + Undo (`PlanHistory.tsx`)

**Growth → Roadmap** (`features/compass/`, `features/ask/`)

- [x] Compass page: Career / Health tabs (`CompassPage.tsx`)
- [x] Career discovery quiz (interests, strengths, values, matches) (`Discovery.tsx`)
- [x] Careers browser + career detail (`CareerBrowser.tsx`)
- [x] Gap analysis + "Your path" + Turn into a plan (`CareerGap.tsx`)
- [x] Roadmaps and study guides (`Roadmaps.tsx`)
- [x] Health check-in + health picture (`HealthCheck.tsx`), health plan (`HealthPlan.tsx`)
- [x] Ask page (answers, sources, fallback, off/offline/quota states) (`AskPage.tsx`)

**Growth → Skills / Jobs** (`features/skills/`, `features/jobs/`)

- [x] Study balance 70/30 card (`BalanceCard.tsx`)
- [x] Skill tree (branches, nodes, levels) (`SkillTree.tsx`)
- [x] Skill sheet: detail, evidence, projects, editor, delete confirm (`SkillSheet.tsx`, `SkillForms.tsx`)
- [x] Jobs page: stats, list (mobile) / board (desktop) (`JobsPage.tsx`, `JobStats.tsx`, `JobCard.tsx`)
- [x] Application sheet (log / edit / stage / delete confirm) (`JobForm.tsx`)

**Me** (`features/profile/`, `features/body/`, `features/review/`, `features/screentime/`, `features/knows/`, `features/achievements/`)

- [x] Me screen with tabs Stats & achievements · Body · Reviews, Screen time tile, Settings gear
- [x] Player card (level, rank, next rank, totals), title picker (`ProfilePage.tsx`, `TitlePicker.tsx`)
- [x] Stats triangle / radar (`StatTriangle.tsx`)
- [x] XP per week chart; active-days heatmap (`Heatmap.tsx`)
- [x] Achievements list (`achievements/AchievementList.tsx`)
- [x] What the System knows about you (`knows/KnowsPage.tsx`)
- [x] Body: today's log form, last 14 days, Health Connect note (`BodyPage.tsx`)
- [x] Body: trends charts (`BodyTrends.tsx`), photos (add / view / delete confirm) (`Photos.tsx`)
- [x] Reviews: Daily check-in (`DailyCheckIn.tsx`), Weekly review incl. screen-time line (`WeeklyReview.tsx`, `ScreenWeekLine.tsx`), Monthly / Yearly summaries (`PeriodSummary.tsx`, `Stat.tsx`), tabs (`ReviewPage.tsx`)
- [x] Screen time screen: today vs limit, week chart, top apps, off state (`ScreenTimePage.tsx`)

**Settings** (`features/settings/`, `features/screentime/ScreenTimeSettings.tsx`, `features/backup/`)

- [x] Settings page layout + Settings gear entry, version (`SettingsPage.tsx`)
- [x] Appearance → theme picker with live mini-previews (replaces light/dark) + Effects (Full / Light / Off) + sound & haptics
- [x] Account & sync: sign-in, status line, sync choice dialog (`AccountSection.tsx`, `SyncStatusLine.tsx`, `SyncChoice.tsx`)
- [x] Day / week / wake-up / core quests sections (`sections.tsx`)
- [x] Notifications + quiet hours + exact timing + battery guide + test (`NotificationSettings.tsx`, `ReliableReminders.tsx`)
- [x] Goal planner / Auto-plan (`PlannerSettings.tsx`), Ask (`AskSettings.tsx`), Jobs (`JobsSettings.tsx`), Health Connect (`HealthSettings.tsx`), Screen time (`ScreenTimeSettings.tsx`)
- [x] Backup: export / import panel / photos zip (`BackupSection.tsx`, `backup/ImportPanel.tsx`)
- [x] Data: rebuild progress, reset all data confirm (`sections.tsx`)
- [x] My data page: stored, space, sent-outside log, exports (`MyDataPage.tsx`)
- [x] Compaction (preview, confirm) (`Compaction.tsx`), Delete everything (confirm, progress, result) (`DeleteEverything.tsx`)

**Onboarding** (`features/onboarding/`)

- [x] Steps: name, wake time, quests (templates, core), dream & main quests (+ start today / tomorrow after 6 PM; no theme step — ELEVATE only); sign-in on a new device (`OnboardingPage.tsx`, `steps.tsx`, `QuestsStep.tsx`)

**Moments, VFX and system surfaces**

- [x] Quest complete, min→full upgrade, Daily Clear, streak milestone effects
- [x] Level-up moment (full screen, skippable) (`moments/LevelUpMoment.tsx`)
- [x] Rank-up moment (bigger, rare)
- [x] Achievement unlocked toast (`achievements/AchievementToast.tsx`)
- [x] In-app reminder banners / notices (`NotificationBridge.tsx`)
- [x] Update prompt (`app/UpdatePrompt.tsx`)
- [x] Error screen + route error (`app/ErrorScreen.tsx`, `app/ErrorBoundary.tsx`)
- [x] Loading states (startup, lists), offline / sync-paused lines, confirmations, form errors
- [x] Charts in the theme (`ui/charts/ChartCard.tsx`, `DailyBars.tsx`, `TrendLine.tsx`)
- [x] Primitives: Button, Field / TextInput / Select, Switch, ProgressBar, StatChip (`ui/`)

**Android**

- [x] Home-screen widgets (small, medium) in the theme (`android/…/AscendWidget*.java`, widget layouts)
- [x] Splash and status bar in the theme

## Production hardening (2026-11-10)

Phased security / production-readiness programme; reports in `docs/audit/`. Nothing goes to production (push to `main`, `supabase db push`) without Rishi's go-ahead.

- [x] H.1 Discovery and architecture audit — `docs/audit/phase-1-discovery.md`
- [x] H.2 Security and privacy assessment — `docs/audit/phase-2-security-assessment.md` (V-01…V-18)
- [x] H.3 Critical/high remediation: V-01 sign-up allow-list migration, V-03 CSP + headers (+ `e2e/security.spec.ts`), V-04 no Android backup — `docs/audit/phase-3-remediation.md`. **Deployed 2026-11-10** (Rishi's go-ahead): migration applied, site live with CSP; security + smoke e2e pass against production. **Waiting:** Rishi turns off the dashboard sign-up switch.
- [x] H.4 Auth, authorization and database hardening (V-02, V-09, V-10, V-11) — `docs/audit/phase-4-auth-db-hardening.md`. **Deployed 2026-11-11**; live probes + 16 e2e against production pass. Owner: manual delete-account check.
- [x] H.5 Backend and API improvements (V-12, V-13, V-15, V-17) — `docs/audit/phase-5-backend-api.md`. **Deployed 2026-11-11**; live CORS probes + production e2e pass.
- [x] H.6 Frontend quality and performance — `docs/audit/phase-6-frontend-performance.md` (meta CSP for Android, verified in the emulator; code-splitting measured and rejected; no leaks). **Deployed 2026-11-11**; 22 e2e against production pass.
- [x] H.7 AI and third-party integration security (V-14) — `docs/audit/phase-7-ai-third-party.md`. **Deployed 2026-11-11**; live probes + 16 production e2e pass. Owner: ask one real question.
- [x] H.8 Testing, debugging and regression verification — `docs/audit/phase-8-testing.md` (planner 1.5 s → 35 ms; live-API regression spec). **Deployed 2026-11-11**; 24 production e2e + 6 live API pass.
- [x] H.9 Infrastructure and deployment readiness (V-06, V-08, V-16) — `docs/audit/phase-9-infrastructure.md`, `docs/operations/RUNBOOK.md`. **Merged and deployed 2026-11-11**; CI green on `main`, daily live checks active. **Waiting:** branch protection on `main` (Rishi).
- [x] H.10 Final independent security and production audit — `docs/audit/FINAL-REPORT.md` (verdict: ready for single-owner use; owner actions listed in section 10).

## Product clarity (2026-11-11)

Audit and approved proposal: `docs/product/AUDIT-AND-PROPOSAL.md`. No database changes in any phase.

- [x] UX-1 Layout bugs — no sideways scroll at 360 px (14 grids), Ask in the header instead of floating; `e2e/layout.spec.ts`. **Waiting:** go-ahead to deploy.
- [ ] UX-2 One next action (P1, P14)
- [ ] UX-3 Today restructure (P3, P4, P15)
- [ ] UX-4 Goals → execution (P5, P13)
- [ ] UX-5 Navigation and terminology (P7, P8, P9)
- [ ] UX-6 Me and Settings (P10–P12)
- [ ] UX-7 States and polish
