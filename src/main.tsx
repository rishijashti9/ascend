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
  // Close past days and start today before the first screen (never blocks startup on error).
  await startRollover();
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
  await startSuggestion();
  startAutoPlanner();
  startAchievements();
  startMoments();
  if (isEnabled('notifications')) startNotificationScheduler(getNotifier());
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
