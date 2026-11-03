import { startAdaptive } from '@/core/state/adaptive';
import { startLearningRecorder } from '@/app/learning';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { startRollover } from './app/rollover';
import { runWeeklyLocalBackup } from './app/localBackup';
import { ErrorScreen } from './app/ErrorScreen';
import { applyTheme } from './app/theme';
import { openDatabase } from './core/db/open';
import { installGlobalErrorHandlers, logError } from './core/errorLog';
import { startAutoPlanner } from './core/planner/auto';
import { startAchievements } from './core/achievements/auto';
import { startAchievementsStore } from './core/state/achievements';
import { startMoments } from './core/state/moments';
import { startAuthRedirects } from './app/auth';
import { accountStore, startAccount } from './core/state/account';
import { startSync } from './core/state/sync';
import { supabaseBackend } from './core/sync/backend';
import { getSupabase } from './core/sync/client';
import { getNotifier } from './app/notify';
import { isEnabled } from './config/features';
import { startNotificationScheduler } from './core/notifications/scheduler';
import { startHealthReader } from './core/health/runner';
import { processPending } from './core/pending/queue';
import { startWidgetWriter } from './core/widget/writer';
import { widgetBridge } from './app/widgetBridge';
import { pushNotice } from './core/state/notices';
import { healthConnect } from './app/health';
import { isNativeApp } from './app/platform';
import { startSuggestion } from './core/state/suggestion';
import { appStore, startAppState } from './core/state/app';
import { startBody } from './core/state/body';
import { startFocusStore } from './core/state/focus';
import { startGoals } from './core/state/goals';
import { startHabits } from './core/state/habits';
import { startQuests } from './core/state/quests';
import { startReviews } from './core/state/reviews';
import { startSkills } from './core/state/skills';
import { startJobs } from './core/state/jobs';
import { rebuildProgress, startProgressStore } from './core/state/progress';
import { startToday } from './core/state/today';
import { recordAction } from './core/pipeline';
import { screenBridge } from './app/screenTime';
import { readScreenTime } from './core/screentime/reader';
import { judgeRecentDays } from './core/screentime/judge';
import { startScreenTime } from './core/screentime/runner';
import { startScreenStore } from './core/state/screen';
import { db } from './core/db/db';
import './styles/index.css';

installGlobalErrorHandlers();

// Follows the system theme until the stored preference is loaded.
let stopTheme = applyTheme('system');
let shownTheme = 'system';
appStore.subscribe(({ settings }) => {
  if (!settings || settings.theme === shownTheme) return;
  stopTheme();
  shownTheme = settings.theme;
  stopTheme = applyTheme(settings.theme);
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');
const root = createRoot(container);

async function start(): Promise<void> {
  // Developer tools exist only in `npm run dev`; this whole branch is removed from builds.
  const dev = import.meta.env.DEV ? await import('./dev') : null;
  dev?.restoreDevClock();

  // Database migrations run before any screen loads (SPEC 9).
  await openDatabase();
  // Consistency check: stored day fields must match their quests (fixes only what's wrong).
  await rebuildProgress().catch((error: unknown) => logError(error, 'consistency check'));
  // Widget taps made while ASCEND was closed count first, at their real tap time (task 10.3).
  const widgets = isEnabled('widgets') && isNativeApp();
  const runQueue = async () => {
    const { problems } = await processPending(widgetBridge);
    for (const [i, body] of problems.entries()) {
      pushNotice({
        key: `widget:${Date.now()}:${i}`,
        kind: 'widget',
        at: Date.now(),
        day: '',
        title: 'A widget tap didn’t count',
        body,
        path: '/',
      });
    }
  };
  if (widgets) await runQueue().catch((error: unknown) => logError(error, 'pending.startup'));
  // Screen time (Phase 11, Android): yesterday's final totals first, so its Digital discipline
  // quest is judged on real numbers when the day closes.
  const screen = isEnabled('screenTime') && isNativeApp();
  if (screen) {
    await readScreenTime(screenBridge, db);
    await judgeRecentDays(db); // days still open since the last visit
  }
  // Close past days and start today before the first screen (never blocks startup on error).
  await startRollover();
  if (screen) await judgeRecentDays(db); // days the app was never opened on
  void runWeeklyLocalBackup();
  // Starter skill tree: adds only the roadmap skills this device doesn't have yet.
  if (isEnabled('skills')) {
    await recordAction({ type: 'skills.seed', source: 'system', payload: {} }).catch(
      (error: unknown) => logError(error, 'skills.seed'),
    );
  }
  await startProgressStore();
  await startAppState();
  await startToday();
  await startHabits();
  await startGoals();
  await startQuests();
  await startFocusStore();
  await startBody();
  await startReviews();
  await startAchievementsStore();
  if (isEnabled('skills')) await startSkills();
  if (isEnabled('jobs')) await startJobs();
  // Screen time numbers also show on the laptop (synced from the phone).
  if (isEnabled('screenTime')) await startScreenStore();
  if (isEnabled('sync')) {
    await startAccount();
    startAuthRedirects((notice) => accountStore.setState({ notice }));
    startSync(
      () => {
        const client = getSupabase();
        return client ? supabaseBackend(client) : null;
      },
      // "Use my account's data" / a fresh install's download: restart on the new data.
      { onLocalDataReplaced: () => window.location.reload() },
    );
  }
  await startAdaptive();
  await startSuggestion();
  startLearningRecorder();
  startAutoPlanner();
  startAchievements();
  startMoments();
  if (isEnabled('notifications')) startNotificationScheduler(getNotifier());
  if (widgets) {
    startWidgetWriter(widgetBridge);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void runQueue().catch((error: unknown) => logError(error, 'pending.resume'));
      }
    });
  }
  if (screen) {
    startScreenTime(screenBridge, db, (listener) => {
      const onVisible = () => {
        if (document.visibilityState === 'visible') listener();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    });
  }
  if (isEnabled('health') && isNativeApp()) {
    startHealthReader(healthConnect, (listener) => {
      const onVisible = () => {
        if (document.visibilityState === 'visible') listener();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    });
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  dev?.mountDevTools();
}

start().catch((error: unknown) => {
  logError(error, 'startup');
  root.render(
    <ErrorScreen
      message={`Could not start ASCEND. ${error instanceof Error ? error.message : ''}`}
    />,
  );
});
