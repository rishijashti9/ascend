import { isEnabled, type FeatureKey } from '@/config/features';

export type MeTab = 'stats' | 'body' | 'reviews';

const TABS: { id: MeTab; label: string; feature: FeatureKey }[] = [
  { id: 'stats', label: 'Stats & achievements', feature: 'profile' },
  { id: 'body', label: 'Body', feature: 'body' },
  { id: 'reviews', label: 'Reviews', feature: 'review' },
];

/** The Me tabs that are built (Phase 12). */
export function meTabs() {
  return TABS.filter((t) => isEnabled(t.feature));
}
