import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { recordAction, RuleError, type Action } from '@/core/pipeline';
import { WIDGET_ACTIONS } from '@/core/pipeline/actions/pending';
import type { WidgetBridge } from '@/core/widget/bridge';

/** Messages for taps that couldn't count (e.g. "The wake-up window has closed for today"). */
export type QueueResult = { processed: number; problems: string[] };

let running: Promise<QueueResult> | null = null;

/**
 * Runs the widget queue (task 10.3): copy native taps into the database, clear them from the
 * phone, then run every unprocessed one with its tap time and source `widget`. Each tap's id is
 * its action id, so even a crash between steps never counts a tap twice. One run at a time.
 */
export function processPending(
  bridge: WidgetBridge,
  database: AscendDB = defaultDb,
): Promise<QueueResult> {
  running ??= run(bridge, database).finally(() => {
    running = null;
  });
  return running;
}

async function run(bridge: WidgetBridge, database: AscendDB): Promise<QueueResult> {
  const result: QueueResult = { processed: 0, problems: [] };
  try {
    const taps = (await bridge.peekPending()).filter((t) =>
      (WIDGET_ACTIONS as readonly string[]).includes(t.type),
    );
    if (taps.length > 0) {
      await recordAction(
        { type: 'pending.enqueue', source: 'widget', payload: { taps } },
        { db: database },
      );
    }
    const all = await bridge.peekPending();
    if (all.length > 0) await bridge.removePending(all.map((t) => t.id));
  } catch (error) {
    logError(error, 'pending.copy');
  }

  const rows = (await database.pending_actions.toArray())
    .filter((r) => r.processed_at === null && r.deleted_at === null)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  for (const row of rows) {
    let done = false;
    try {
      await recordAction(
        {
          type: row.action,
          payload: row.payload,
          occurred_at: row.occurred_at,
          source: 'widget',
          action_id: `widget:${row.id}`,
        } as Action,
        { db: database },
      );
      result.processed += 1;
      done = true;
    } catch (error) {
      // A rule said no (e.g. tapped after the wake-up cutoff): tell Rishi, don't retry forever.
      // Anything unexpected stays queued and is tried again next time.
      if (error instanceof RuleError) {
        result.problems.push(error.message);
        done = true;
      } else logError(error, `pending.run:${row.action}`);
    }
    if (done) {
      await recordAction(
        { type: 'pending.markProcessed', source: 'system', payload: { id: row.id } },
        { db: database },
      ).catch((error: unknown) => logError(error, 'pending.mark'));
    }
  }
  return result;
}
