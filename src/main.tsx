import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyTheme } from './app/theme';
import { installGlobalErrorHandlers } from './core/errorLog';
import './styles/index.css';

installGlobalErrorHandlers();

// Follows the system theme until Settings (task 2.12) stores a preference.
applyTheme('system');

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
