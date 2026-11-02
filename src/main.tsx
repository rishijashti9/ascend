import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { startRollover } from './app/rollover';
import { ErrorScreen } from './app/ErrorScreen';
import { applyTheme } from './app/theme';
import { openDatabase } from './core/db/open';
import { installGlobalErrorHandlers, logError } from './core/errorLog';
import { startAutoPlanner } from './core/planner/auto';
import { appStore, startAppState } from './core/state/app';
import { startBody } from './core/state/body';
import { startFocusStore } from './core/state/focus';
import { startGoals } from './core/state/goals';
import { startHabits } from './core/state/habits';
import { startQuests } from './core/state/quests';
import { rebuildProgress, startProgressStore } from './core/state/progress';
import { startToday } from './core/state/today';
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
  await startProgressStore();
  await startAppState();
  await startToday();
  await startHabits();
  await startGoals();
  await startQuests();
  await startFocusStore();
  await startBody();
  startAutoPlanner();
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
