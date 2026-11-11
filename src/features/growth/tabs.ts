import { isAvailable, type FeatureKey } from '@/config/features';

export type GrowthTab = 'goals' | 'compass' | 'skills' | 'jobs';

const TABS: { id: GrowthTab; label: string; feature: FeatureKey }[] = [
  { id: 'goals', label: 'Goals', feature: 'goals' },
  { id: 'compass', label: 'Compass', feature: 'compass' },
  { id: 'skills', label: 'Skills', feature: 'skills' },
  { id: 'jobs', label: 'Jobs', feature: 'jobs' },
];

export function growthTabs(settings: { jobs_enabled?: boolean } | null | undefined) {
  return TABS.filter((t) => isAvailable(t.feature, settings));
}
