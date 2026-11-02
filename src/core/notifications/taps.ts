import { recordAction, RuleError } from '@/core/pipeline';
import type { NotificationTap } from './types';

/**
 * What a tap does. "I'm up" completes the wake-up check-in at the time of the tap — even if
 * the app only processes it later (SPEC 7: the tap time counts). The action id makes a tap
 * delivered twice count once. Returns a short message when it couldn't count.
 */
export async function handleTap(tap: NotificationTap): Promise<string | null> {
  if (!tap.wakeUp || !tap.wakeInstanceId) return null;
  try {
    await recordAction({
      type: 'quest.wakeCheckin',
      payload: { instanceId: tap.wakeInstanceId },
      occurred_at: new Date(tap.at).toISOString(),
      source: 'notification',
      action_id: `notification:${tap.key}`,
    });
    return null;
  } catch (error) {
    if (error instanceof RuleError) return error.message;
    throw error;
  }
}
