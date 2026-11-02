import { createBrowserRouter, RouterProvider } from 'react-router';
import { isEnabled } from '@/config/features';
import { useAppState } from '@/core/state/app';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { ErrorBoundary } from './ErrorBoundary';
import { isNativeApp } from './platform';
import { buildRoutes } from './routes';
import { UpdatePrompt } from './UpdatePrompt';

const router = createBrowserRouter(buildRoutes());

export function App() {
  const needsOnboarding = useAppState(
    (s) => s.status === 'ready' && !s.profile?.onboarded_at && isEnabled('onboarding'),
  );
  return (
    <ErrorBoundary>
      {needsOnboarding ? <OnboardingPage /> : <RouterProvider router={router} />}
      {/* The Android app updates through a new APK; a service worker there could serve a stale copy. */}
      {!isNativeApp() && <UpdatePrompt />}
    </ErrorBoundary>
  );
}
