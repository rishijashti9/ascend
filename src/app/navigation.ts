import {
  Activity,
  Briefcase,
  Compass,
  ListChecks,
  Menu,
  MessageCircleQuestion,
  Network,
  NotebookPen,
  Settings,
  Sun,
  Target,
  Timer,
  User,
  type LucideIcon,
} from 'lucide-react';
import { isAvailable, isEnabled, type FeatureKey } from '@/config/features';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  feature: FeatureKey;
}

/** Bottom bar on mobile (max 5: Today · Quests · Focus · Goals · More). */
const PRIMARY: NavItem[] = [
  { path: '/', label: 'Today', icon: Sun, feature: 'today' },
  { path: '/quests', label: 'Quests', icon: ListChecks, feature: 'quests' },
  { path: '/focus', label: 'Focus', icon: Timer, feature: 'focus' },
  { path: '/goals', label: 'Goals', icon: Target, feature: 'goals' },
];

/** Listed on the "More" page on mobile, and directly in the desktop sidebar. */
const SECONDARY: NavItem[] = [
  { path: '/body', label: 'Body', icon: Activity, feature: 'body' },
  { path: '/review', label: 'Review', icon: NotebookPen, feature: 'review' },
  { path: '/skills', label: 'Skills', icon: Network, feature: 'skills' },
  { path: '/compass', label: 'Compass', icon: Compass, feature: 'compass' },
  { path: '/ask', label: 'Ask', icon: MessageCircleQuestion, feature: 'ask' },
  { path: '/jobs', label: 'Jobs', icon: Briefcase, feature: 'jobs' },
  { path: '/profile', label: 'Profile', icon: User, feature: 'profile' },
  { path: '/settings', label: 'Settings', icon: Settings, feature: 'settings' },
];

export const MORE_ITEM: NavItem = { path: '/more', label: 'More', icon: Menu, feature: 'today' };

export function primaryNav(): NavItem[] {
  return PRIMARY.filter((item) => isEnabled(item.feature));
}

/** Jobs shows only once it's switched on in Settings. */
export function secondaryNav(settings?: { jobs_enabled?: boolean } | null): NavItem[] {
  return SECONDARY.filter((item) => isAvailable(item.feature, settings));
}
