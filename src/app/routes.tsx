import { Navigate, type RouteObject } from 'react-router';
import { isEnabled, type FeatureKey } from '@/config/features';
import { BodyPage } from '@/features/body/BodyPage';
import { FocusPage } from '@/features/focus/FocusPage';
import { GoalsPage } from '@/features/goals/GoalsPage';
import { MainQuestPage } from '@/features/goals/MainQuestPage';
import { MorePage } from '@/features/more/MorePage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { QuestsPage } from '@/features/quests/QuestsPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { SkillsPage } from '@/features/skills/SkillsPage';
import { JobsPage } from '@/features/jobs/JobsPage';
import { KnowsPage } from '@/features/knows/KnowsPage';
import { TodayPage } from '@/features/today/TodayPage';
import { RouteErrorScreen } from './ErrorBoundary';
import { Layout } from './Layout';

/** Screens by path. A route exists only while its feature flag is on. */
const SCREENS: { path: string; feature: FeatureKey; element: React.ReactNode }[] = [
  { path: 'quests', feature: 'quests', element: <QuestsPage /> },
  { path: 'focus', feature: 'focus', element: <FocusPage /> },
  { path: 'body', feature: 'body', element: <BodyPage /> },
  { path: 'review', feature: 'review', element: <ReviewPage /> },
  { path: 'goals', feature: 'goals', element: <GoalsPage /> },
  { path: 'goals/:id', feature: 'goals', element: <MainQuestPage /> },
  { path: 'skills', feature: 'skills', element: <SkillsPage /> },
  { path: 'jobs', feature: 'jobs', element: <JobsPage /> },
  { path: 'profile', feature: 'profile', element: <ProfilePage /> },
  { path: 'settings', feature: 'settings', element: <SettingsPage /> },
  { path: 'knows', feature: 'adaptive', element: <KnowsPage /> },
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
