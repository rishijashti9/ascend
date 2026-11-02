import { createRoot } from 'react-dom/client';
import { DevTools } from './DevTools';
import { restoreDevClock } from './devClock';

export { restoreDevClock };

/** Mounts the developer tools in their own root, outside the app. Dev builds only. */
export function mountDevTools(): void {
  const host = document.createElement('div');
  host.id = 'ascend-devtools';
  document.body.appendChild(host);
  createRoot(host).render(<DevTools />);
}
