/**
 * Feature flags: a feature is switched on here only when its phase is fully built.
 * Anything switched off is completely hidden: no tabs, buttons or locked items.
 */
export const features = {
  // Phase 1
  today: true,
  settings: true,
  // Phase 2
  onboarding: true,
  quests: true,
  exportImport: true,
  // Phase 3
  goals: true,
  // Phase 4
  focus: true,
  body: true,
  // Phase 5
  review: true,
  profile: true,
  // Phase 6
  notifications: true,
  // Phase 7
  sync: true,
  // Phase 9 (Jobs also needs to be switched on in Settings)
  skills: true,
  jobs: true,
  // Phase 10
  health: true,
  widgets: true,
  // Phase 8 (Adaptive System, Growth Compass, Ask the System)
  adaptive: true,
  compass: true,
  ask: true,
  // Phase 11 (Screen Time — also switched on in Settings; Android only)
  screenTime: false,
} as const satisfies Record<string, boolean>;

export type FeatureKey = keyof typeof features;

export function isEnabled(key: FeatureKey): boolean {
  return features[key];
}

/**
 * Built AND wanted: the Job tracker is also switched on in Settings (SPEC 6.5 — Rishi's job
 * search is paused, so it stays hidden until he turns it on).
 */
export function isAvailable(
  key: FeatureKey,
  settings: { jobs_enabled?: boolean } | null | undefined,
): boolean {
  if (!isEnabled(key)) return false;
  return key !== 'jobs' || settings?.jobs_enabled === true;
}
