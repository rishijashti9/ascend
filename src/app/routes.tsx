import { Navigate, type RouteObject } from 'react-router';
import { isEnabled, type FeatureKey } from '@/config/features';
import { MorePage } from '@/features/more/MorePage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TodayPage } from '@/features/today/TodayPage';
import { RouteErrorScreen } from './ErrorBoundary';
import { Layout } from './Layout';

/** Screens by path. A route exists only while its feature flag is on. */
const SCREENS: { path: string; feature: FeatureKey; element: React.ReactNode }[] = [
  { path: 'settings', feature: 'settings', element: <SettingsPage /> },
];

export function buildRoutes(): RouteObject[] {
  return [
    {
      path: '/',
      element: <Layout />,
      errorElement: <RouteErrorScreen />,
      children: [
        { index: true, element: <TodayPage /> },
        { path: 'more', element: <MorePage /> },
        ...SCREENS.filter((s) => isEnabled(s.feature)).map(({ path, element }) => ({
          path,
          element,
        })),
        // Unknown or hidden routes go home instead of showing a dead page.
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ];
}
