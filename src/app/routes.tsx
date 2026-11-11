import { Navigate, type RouteObject } from 'react-router';
import { isEnabled, type FeatureKey } from '@/config/features';
import { BodyPage } from '@/features/body/BodyPage';
import { FocusPage } from '@/features/focus/FocusPage';
import { GoalsPage } from '@/features/goals/GoalsPage';
import { MainQuestPage } from '@/features/goals/MainQuestPage';
import { GrowthPage } from '@/features/growth/GrowthPage';
import { MePage } from '@/features/me/MePage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { QuestsPage } from '@/features/quests/QuestsPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { SkillsPage } from '@/features/skills/SkillsPage';
import { JobsPage } from '@/features/jobs/JobsPage';
import { KnowsPage } from '@/features/knows/KnowsPage';
import { MyDataPage } from '@/features/settings/MyDataPage';
import { CompassPage } from '@/features/compass/CompassPage';
import { ScreenTimePage } from '@/features/screentime/ScreenTimePage';
import { AskPage } from '@/features/ask/AskPage';
import { TodayPage } from '@/features/today/TodayPage';
import { RouteErrorScreen } from './ErrorBoundary';
import { Layout } from './Layout';
import { MOVED } from './navigation';
import { GrowthIndex, Moved, MovedGoal } from './Redirects';

type Screen = { path: string; feature: FeatureKey; element: React.ReactNode };

const TOP: Screen[] = [
  { path: 'quests', feature: 'quests', element: <QuestsPage /> },
  { path: 'focus', feature: 'focus', element: <FocusPage /> },
  { path: 'settings', feature: 'settings', element: <SettingsPage /> },
  { path: 'my-data', feature: 'settings', element: <MyDataPage /> },
  { path: 'ask', feature: 'ask', element: <AskPage /> },
  { path: 'me/screen-time', feature: 'screenTime', element: <ScreenTimePage /> },
  { path: 'me/knows', feature: 'adaptive', element: <KnowsPage /> },
];

const GROWTH: Screen[] = [
  { path: 'goals', feature: 'goals', element: <GoalsPage /> },
  { path: 'goals/:id', feature: 'goals', element: <MainQuestPage /> },
  { path: 'compass', feature: 'compass', element: <CompassPage /> },
  { path: 'skills', feature: 'skills', element: <SkillsPage /> },
  { path: 'jobs', feature: 'jobs', element: <JobsPage /> },
];

const ME: Screen[] = [
  { path: 'stats', feature: 'profile', element: <ProfilePage /> },
  { path: 'body', feature: 'body', element: <BodyPage /> },
  { path: 'reviews', feature: 'review', element: <ReviewPage /> },
];

const built = (list: Screen[]) =>
  list.filter((s) => isEnabled(s.feature)).map(({ path, element }) => ({ path, element }));

export function buildRoutes(): RouteObject[] {
  return [
    {
      path: '/',
      element: <Layout />,
      errorElement: <RouteErrorScreen />,
      children: [
        { index: true, element: <TodayPage /> },
        ...built(TOP),
        ...(isEnabled('goals')
          ? [
              {
                path: 'growth',
                element: <GrowthPage />,
                children: [{ index: true, element: <GrowthIndex /> }, ...built(GROWTH)],
              },
            ]
          : []),
        ...(isEnabled('profile')
          ? [
              {
                path: 'me',
                element: <MePage />,
                children: [{ index: true, element: <Navigate to="stats" replace /> }, ...built(ME)],
              },
            ]
          : []),
        ...Object.keys(MOVED).map((path) => ({ path: path.slice(1), element: <Moved /> })),
        { path: 'goals/:id', element: <MovedGoal /> },
        // Unknown or hidden routes go home instead of showing a dead page.
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ];
}
