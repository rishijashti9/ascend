import { z } from 'zod';
import { db as defaultDb, type AscendDB, type TableName } from '@/core/db/db';
import { emit, type DomainEvent } from './events';
import { isoNow, newBase } from './records';
import { getAction, type ActionContext, type ActionSource, type XpEventInput } from './registry';

/**
 * The single entry point for every change to stored data (SPEC 6.6):
 *   validate → idempotency check → one transaction → emit events → subscribers react.
 * No screen writes to the database directly.
 */
export interface Action {
  type: string;
  payload: unknown;
  /** Real time of the action (ISO). Defaults to now. Widget/notification taps pass their tap time. */
  occurred_at?: string;
  source?: ActionSource;
  /**
   * Optional unique id for actions that may be delivered more than once
   * (widget queue, notification, sync). A repeated id is ignored.
   */
  action_id?: string;
}

export interface ActionResult<R = unknown> {
  value: R | undefined;
  events: DomainEvent[];
  duplicate: boolean;
}

export class ActionValidationError extends Error {
  constructor(
    public readonly actionType: string,
    detail: string,
  ) {
    super(`Invalid action "${actionType}": ${detail}`);
    this.name = 'ActionValidationError';
  }
}

const envelopeSchema = z.object({
  type: z.string().min(1),
  payload: z.unknown(),
  occurred_at: z.iso.datetime().optional(),
  source: z.string().optional(),
  action_id: z.string().min(1).optional(),
});

export async function recordAction<R = unknown>(
  action: Action,
  options: { db?: AscendDB } = {},
): Promise<ActionResult<R>> {
  const database = options.db ?? defaultDb;

  const envelope = envelopeSchema.safeParse(action);
  if (!envelope.success) {
    throw new ActionValidationError(String(action.type), z.prettifyError(envelope.error));
  }
  const def = getAction(action.type);
  if (!def) throw new ActionValidationError(action.type, 'unknown action type');

  const parsed = def.schema.safeParse(action.payload);
  if (!parsed.success) throw new ActionValidationError(action.type, z.prettifyError(parsed.error));

  const processedAt = isoNow();
  const occurredAt = action.occurred_at ?? processedAt;
  const events: DomainEvent[] = [];
  const tables = [...new Set<TableName>([...def.tables, 'xp_events', 'meta'])];

  const outcome = await database.transaction('rw', tables, async () => {
    if (action.action_id) {
      const seenKey = `action:${action.action_id}`;
      if (await database.meta.get(seenKey)) return { duplicate: true as const, value: undefined };
      await database.meta.put({ id: seenKey, value: processedAt });
    }

    const ctx: ActionContext = {
      db: database,
      occurredAt,
      processedAt,
      source: action.source ?? 'ui',
      emit: (event) => events.push(event),
      async addXpEvent(event: XpEventInput) {
        const existing = await database.xp_events
          .where('idempotency_key')
          .equals(event.idempotency_key)
          .first();
        if (existing) return false;
        await database.xp_events.add({ ...newBase(), ...event });
        return true;
      },
    };

    const value = (await def.run(ctx, parsed.data)) as R;
    return { duplicate: false as const, value };
  });

  // Only after a successful commit.
  if (!outcome.duplicate) await emit(events);
  return {
    value: outcome.value,
    events: outcome.duplicate ? [] : events,
    duplicate: outcome.duplicate,
  };
}
