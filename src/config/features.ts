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
  // Phase 7 — visible only in the local dev server (`npm run dev`) until the phase is done.
  sync: import.meta.env.DEV,
  // Phase 9 (Jobs also needs to be switched on in Settings)
  skills: false,
  jobs: false,
} as const satisfies Record<string, boolean>;

export type FeatureKey = keyof typeof features;

export function isEnabled(key: FeatureKey): boolean {
  return features[key];
}
