import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
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

// Database migrations run before any screen loads (SPEC 9).
openDatabase()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    logError(error, 'openDatabase');
    root.render(
      <ErrorScreen
        message={`Could not open the local database. ${error instanceof Error ? error.message : ''}`}
      />,
    );
  });
