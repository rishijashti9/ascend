import { ListChecks, Settings, Sprout, Sun, Timer, User, type LucideIcon } from 'lucide-react';
import { isEnabled, type FeatureKey } from '@/config/features';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  feature: FeatureKey;
  /** The big centre button (Focus). */
  centre?: boolean;
}

/**
 * Phase 12 navigation (SPEC 6.9): Today · Quests · [Focus] · Growth · Me — the same five in the
 * mobile bottom bar (Focus as the big centre button) and the desktop sidebar. There is no More
 * tab: Goals / Roadmap / Skills / Jobs live in Growth; Stats / Body / Reviews / Screen time in
 * Me; Settings behind the gear in Me (and at the end of the sidebar).
 */
const PRIMARY: NavItem[] = [
  { path: '/', label: 'Today', icon: Sun, feature: 'today' },
  { path: '/quests', label: 'Quests', icon: ListChecks, feature: 'quests' },
  { path: '/focus', label: 'Focus', icon: Timer, feature: 'focus', centre: true },
  { path: '/growth', label: 'Growth', icon: Sprout, feature: 'goals' },
  { path: '/me', label: 'Me', icon: User, feature: 'profile' },
];

export const SETTINGS_ITEM: NavItem = {
  path: '/settings',
  label: 'Settings',
  icon: Settings,
  feature: 'settings',
};

export function primaryNav(): NavItem[] {
  return PRIMARY.filter((item) => isEnabled(item.feature));
}

/**
 * Where old addresses went in Phase 12 (deep links, notification taps, widget taps and saved
 * bookmarks keep working). The query string is kept.
 */
export const MOVED: Record<string, string> = {
  '/goals': '/growth/goals',
  '/compass': '/growth/roadmap',
  '/skills': '/growth/skills',
  '/jobs': '/growth/jobs',
  '/profile': '/me/stats',
  '/body': '/me/body',
  '/review': '/me/reviews',
  '/screen-time': '/me/screen-time',
  '/knows': '/me/knows',
  '/more': '/me',
};

/** The current address for a path (with an optional query), following MOVED. */
export function currentPath(path: string): string {
  const [base = '', query] = path.split('?');
  const goal = base.match(/^\/goals\/(.+)$/);
  const next = goal ? `/growth/goals/${goal[1]}` : (MOVED[base] ?? base);
  return query ? `${next}?${query}` : next;
}
