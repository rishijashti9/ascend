import type { z } from 'zod';
import type { AscendDB, TableName } from '@/core/db/db';
import type { BaseRecord, IsoTime, XpEvent } from '@/core/db/types';
import type { DomainEvent } from './events';

/** An XP event as written by an action (base fields are added automatically). */
export type XpEventInput = Omit<XpEvent, keyof BaseRecord>;

/** Everything an action's `run` may use. All writes happen inside one transaction. */
export interface ActionContext {
  db: AscendDB;
  /** When the action really happened (e.g. the widget tap time), not when it was processed. */
  occurredAt: IsoTime;
  /** When it is being processed. */
  processedAt: IsoTime;
  source: ActionSource;
  /** Queue a domain event; delivered only after the transaction commits. */
  emit(event: DomainEvent): void;
  /**
   * Append an XP event. Returns false (and writes nothing) if an event with the same
   * idempotency key already exists — the same action twice gives one award.
   */
  addXpEvent(event: XpEventInput): Promise<boolean>;
}

export type ActionSource =
  | 'ui'
  | 'widget'
  | 'notification'
  | 'health'
  | 'focus'
  | 'job_log'
  | 'planner'
  | 'rollover'
  | 'sync'
  | 'import'
  | 'dev';

export interface ActionDefinition<S extends z.ZodType = z.ZodType, R = unknown> {
  type: string;
  schema: S;
  /** Tables the action may touch (Dexie transaction scope). `xp_events` is added automatically. */
  tables: TableName[];
  /** Only Dexie operations inside: no fetch/timers, or the transaction auto-commits early. */
  run(ctx: ActionContext, payload: z.infer<S>): Promise<R>;
}

const registry = new Map<string, ActionDefinition>();

export function defineAction<S extends z.ZodType, R>(
  def: ActionDefinition<S, R>,
): ActionDefinition<S, R> {
  if (registry.has(def.type)) throw new Error(`Action "${def.type}" is defined twice`);
  registry.set(def.type, def as unknown as ActionDefinition);
  return def;
}

export function getAction(type: string): ActionDefinition | undefined {
  return registry.get(type);
}

export function registeredActionTypes(): string[] {
  return [...registry.keys()];
}
