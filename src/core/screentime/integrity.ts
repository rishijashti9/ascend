import type { AscendDB } from '@/core/db/db';
import type { IncidentKind } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { recordAction } from '@/core/pipeline';
import type { ScreenBridge, ScreenStatus } from './bridge';
import { getRules } from './store';

/**
 * Integrity (task 11.8, SPEC 6.8): during a lock, switching off what keeps the reminders working
 * — ASCEND's notifications, just the screen-time channel, or Usage access — is an incident:
 * a banner on Today until it's fixed, and the lock gets 7 more days. Checked when ASCEND opens,
 * comes back to the front, and every 15 minutes while open. Never any XP loss.
 */
export const INCIDENT_TEXT: Record<IncidentKind, { title: string; fix: string }> = {
  notifications_off: {
    title: 'ASCEND’s notifications are switched off',
    fix: 'Turn notifications back on',
  },
  channel_off: {
    title: 'Screen-time reminders are switched off in Android settings',
    fix: 'Turn screen-time reminders back on',
  },
  usage_access_off: {
    title: 'Usage access for ASCEND was removed',
    fix: 'Allow usage access again',
  },
};

export function brokenKinds(s: ScreenStatus): IncidentKind[] {
  const out: IncidentKind[] = [];
  if (!s.notifications) out.push('notifications_off');
  else if (!s.channel) out.push('channel_off');
  if (!s.usageAccess) out.push('usage_access_off');
  return out;
}

export async function checkIntegrity(bridge: ScreenBridge, db: AscendDB): Promise<void> {
  if (!bridge.available() || !(await getRules(db))?.enabled) return;
  try {
    const broken = brokenKinds(await bridge.status());
    await recordAction(
      { type: 'screen.reportIncidents', source: 'system', payload: { broken } },
      { db },
    );
  } catch (error) {
    logError(error, 'screen.integrity');
  }
}
