import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { startRollover } from './app/rollover';
import { ErrorScreen } from './app/ErrorScreen';
import { applyTheme } from './app/theme';
import { openDatabase } from './core/db/open';
import { installGlobalErrorHandlers, logError } from './core/errorLog';
import './styles/index.css';

installGlobalErrorHandlers();

// Follows the system theme until Settings (task 2.12) stores a preference.
applyTheme('system');

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');
const root = createRoot(container);

async function start(): Promise<void> {
  // Developer tools exist only in `npm run dev`; this whole branch is removed from builds.
  const dev = import.meta.env.DEV ? await import('./dev') : null;
  dev?.restoreDevClock();

  // Database migrations run before any screen loads (SPEC 9).
  await openDatabase();
  // Close past days and start today before the first screen (never blocks startup on error).
  await startRollover();
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
