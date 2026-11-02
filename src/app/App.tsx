import { createBrowserRouter, RouterProvider } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { isNativeApp } from './platform';
import { buildRoutes } from './routes';
import { UpdatePrompt } from './UpdatePrompt';

const router = createBrowserRouter(buildRoutes());

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      {/* The Android app updates through a new APK; a service worker there could serve a stale copy. */}
      {!isNativeApp() && <UpdatePrompt />}
    </ErrorBoundary>
  );
}
