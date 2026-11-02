/**
 * Keeping reminders alive on phones that kill background apps (Rishi's request, task 6.5).
 * Many Android brands stop scheduled alarms of apps they think are idle unless the app is
 * allowed to run in the background. ASCEND can't change these settings itself, so this is a
 * step-by-step guide per brand. Menu names differ a little between versions — the steps say
 * what to look for.
 */
export interface BrandGuide {
  id: string;
  name: string;
  /** Lower-case manufacturer names (from the device) that pick this guide. */
  matches: string[];
  steps: string[];
}

export const BATTERY_GUIDES: readonly BrandGuide[] = [
  {
    id: 'samsung',
    name: 'Samsung',
    matches: ['samsung'],
    steps: [
      'Settings → Apps → ASCEND → Battery → choose Unrestricted.',
      'Settings → Battery (or Battery and device care) → Background usage limits: make sure ASCEND is not in “Sleeping apps” or “Deep sleeping apps”, and add it to “Never sleeping apps”.',
      'Turn off “Put unused apps to sleep” there too, or ASCEND may be put to sleep after a few quiet days.',
    ],
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi / Redmi / POCO',
    matches: ['xiaomi', 'redmi', 'poco'],
    steps: [
      'Settings → Apps → Manage apps → ASCEND → turn on Autostart.',
      'In the same screen: Battery saver (or Battery) → choose No restrictions.',
      'Open recent apps, long-press (or pull down on) ASCEND’s card and tap the lock, so clearing recents doesn’t close it.',
      'Settings → Apps → Manage apps → ASCEND → Notifications: allow, and allow “Lock screen” and “Floating notifications”.',
    ],
  },
  {
    id: 'realme',
    name: 'Realme',
    matches: ['realme'],
    steps: [
      'Settings → Apps → App management → ASCEND → Battery usage → turn on “Allow background activity” (and “Allow auto launch” if you see it).',
      'Settings → Battery → More settings → turn off “Optimise battery use” for ASCEND (or set it to “Don’t optimise”).',
      'Open recent apps, tap the ⋮ on ASCEND’s card and choose Lock.',
    ],
  },
  {
    id: 'oppo',
    name: 'Oppo / OnePlus',
    matches: ['oppo', 'oneplus'],
    steps: [
      'Settings → Apps → App management → ASCEND → Battery usage → turn on “Allow background activity” and “Allow auto launch”.',
      'Settings → Battery → More settings → Optimise battery use → ASCEND → Don’t optimise.',
      'Open recent apps, tap the ⋮ on ASCEND’s card and choose Lock.',
    ],
  },
  {
    id: 'vivo',
    name: 'Vivo / iQOO',
    matches: ['vivo', 'iqoo'],
    steps: [
      'Settings → Battery → Background power consumption management → ASCEND → Allow (or “Allow high background power consumption”).',
      'Settings → Apps → Autostart (sometimes under i Manager → App manager) → turn on ASCEND.',
      'Open recent apps, pull down on ASCEND’s card to lock it.',
    ],
  },
  {
    id: 'other',
    name: 'Other Android',
    matches: [],
    steps: [
      'Settings → Apps → ASCEND → Battery → choose Unrestricted (or “Not optimised”).',
      'If your phone has an “Autostart” or “Background activity” setting, allow it for ASCEND.',
    ],
  },
];

/** The guide for a manufacturer, or "Other Android". */
export function guideFor(manufacturer: string | null): BrandGuide {
  const m = (manufacturer ?? '').toLowerCase();
  return (
    BATTERY_GUIDES.find((g) => g.matches.some((x) => m.includes(x))) ??
    (BATTERY_GUIDES.at(-1) as BrandGuide)
  );
}
