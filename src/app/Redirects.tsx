import { Navigate, useLocation, useParams } from 'react-router';
import { useAppState } from '@/core/state/app';
import { growthTabs } from '@/features/growth/tabs';
import { currentPath } from './navigation';

/** Old addresses (Phases 1–11) go to their new place, keeping the query string. */
export function Moved() {
  const { pathname, search } = useLocation();
  return <Navigate to={currentPath(`${pathname}${search}`)} replace />;
}

export function MovedGoal() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/growth/goals/${id}${search}`} replace />;
}

export function GrowthIndex() {
  const first = growthTabs(useAppState((s) => s.settings))[0]?.id ?? 'goals';
  return <Navigate to={`/growth/${first}`} replace />;
}
