import { logError } from '@/core/errorLog';
import type { DayString, Stat } from '@/core/db/types';
import type { Rank } from '@/config/game';

/**
 * Domain events (SPEC 6.6). Emitted by recordAction AFTER its transaction commits.
 * Later phases add new event types here; subscribers react (progress engine,
 * achievements, messages, planner, widget, notifications, sync).
 */
export interface DomainEvents {
  SettingsChanged: { changed: string[] };
  HabitChanged: {
    habitId: string;
    change: 'created' | 'updated' | 'paused' | 'archived' | 'restored';
  };
  QuestChanged: { questId: string; change: 'created' | 'updated' | 'archived' | 'restored' };
  QuestCompleted: { instanceId: string; day: DayString; status: string };
  QuestUncompleted: { instanceId: string; day: DayString };
  ProgressAdded: { instanceId: string; day: DayString; amount: number };
  DayChanged: { day: DayString };
  DayClosed: { day: DayString };
  GoalChanged: {
    goalType: string;
    goalId: string;
    change: string;
    meaningful: boolean;
    /** 'planner' when the change came from an applied plan (the planner doesn't react to itself). */
    source: string;
  };
  MilestoneDone: { milestoneId: string };
  PlanProposed: { proposalId: string; goalId: string | null };
  PlanApplied: { proposalId: string | null; historyId: string };
  PlanUndone: { historyId: string };
  SessionStarted: { sessionId: string };
  BodyLogged: { day: DayString };
  ReviewSaved: { reviewType: string; period: string };
  SessionFinished: { sessionId: string; day: DayString; completed: boolean };
  LevelUp: { level: number; stat: Stat | null };
  RankUp: { rank: Rank };
  AchievementUnlocked: { key: string };
  ProfileChanged: { changed: string[] };
  /** A skill, branch or project changed (null = several skills at once). */
  SkillChanged: { skillId: string | null };
  SuggestionAnswered: { kind: string; applied: boolean };
  DataSynced: { applied: number; days: string[] };
  SyncLinked: { clearLocal: boolean };
  DataImported: { mode: 'replace' | 'merge' };
  DataReset: Record<string, never>;
}

export type EventType = keyof DomainEvents;
export type DomainEvent = { [K in EventType]: { type: K; payload: DomainEvents[K] } }[EventType];

type Handler<K extends EventType> = (payload: DomainEvents[K]) => void | Promise<void>;
type AnyHandler = (event: DomainEvent) => void | Promise<void>;

const handlers = new Map<EventType, Set<Handler<EventType>>>();
const anyHandlers = new Set<AnyHandler>();

/** Listen to one event type. Returns an unsubscribe function. */
export function subscribe<K extends EventType>(type: K, handler: Handler<K>): () => void {
  let set = handlers.get(type);
  if (!set) {
    set = new Set();
    handlers.set(type, set);
  }
  set.add(handler as Handler<EventType>);
  return () => set.delete(handler as Handler<EventType>);
}

/** Listen to every event (e.g. sync queue, derived-state refresh). */
export function subscribeAll(handler: AnyHandler): () => void {
  anyHandlers.add(handler);
  return () => anyHandlers.delete(handler);
}

/**
 * Deliver events in order. A failing subscriber is logged and never stops the others,
 * and never undoes the already-committed write.
 */
export async function emit(events: DomainEvent[]): Promise<void> {
  for (const event of events) {
    const calls: (() => void | Promise<void>)[] = [
      ...[...(handlers.get(event.type) ?? [])].map((h) => () => h(event.payload)),
      ...[...anyHandlers].map((h) => () => h(event)),
    ];
    for (const call of calls) {
      try {
        await call();
      } catch (error) {
        logError(error, `event:${event.type}`);
      }
    }
  }
}

/** Test helper: remove every subscriber. */
export function clearSubscribers(): void {
  handlers.clear();
  anyHandlers.clear();
}
