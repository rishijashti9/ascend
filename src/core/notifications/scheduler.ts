import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { appDayOf, getSettings, isoNow, recordAction, subscribeAll } from '@/core/pipeline';
import { LEARNED_KINDS } from './taps';
import { currentTimeZone, nowMs } from '@/core/time';
import { planNotifications, type PlanInput } from './plan';
import type { Notifier, PlannedNotification } from './types';

/** The running scheduler's forced re-plan (e.g. exact alarms were just allowed). */
let active: (() => Promise<PlannedNotification[]>) | null = null;

/**
 * Re-schedules everything even if the plan didn't change — needed after exact alarms are
 * allowed, because reminders already set were scheduled as inexact.
 */
export function rescheduleAll(): Promise<PlannedNotification[]> {
  return active ? active() : Promise.resolve([]);
}

/** Reads everything the planner needs. */
export async function loadPlanInput(database: AscendDB): Promise<PlanInput> {
  return database.transaction(
    'r',
    ['settings', 'profile', 'habits', 'quest_instances', 'reviews', 'job_applications'],
    async () => {
      const today = await appDayOf(database, isoNow());
      return {
        now: nowMs(),
        tz: currentTimeZone(),
        today,
        settings: await getSettings(database),
        startDay: (await database.profile.get('profile'))?.start_day ?? null,
        habits: (await database.habits.toArray()).filter((h) => h.deleted_at === null),
        todayInstances: await database.quest_instances.where('day').equals(today).toArray(),
        followUps: (await database.job_applications.toArray()).filter(
          (j) =>
            j.deleted_at === null &&
            j.follow_up_at !== null &&
            !['offer', 'rejected', 'ghosted'].includes(j.stage),
        ),
        checkInDone: await database.reviews
          .get(`review:daily:${today}`)
          .then((r) => !!r && r.deleted_at === null),
      };
    },
  );
}

/**
 * Keeps the platform's scheduled notifications equal to the plan: re-planned at startup and
 * shortly after anything changes (settings, quests, completions, the day rollover). The
 * notifier is only touched when the list really changed.
 */
export function startNotificationScheduler(
  notifier: Notifier,
  database: AscendDB = defaultDb,
  delayMs = 1000,
): { stop: () => void; refresh: () => Promise<PlannedNotification[]> } {
  let last = '';
  let force = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<PlannedNotification[]> = Promise.resolve([]);

  const refresh = () => {
    chain = chain.then(async () => {
      try {
        const list = planNotifications(await loadPlanInput(database));
        const signature = JSON.stringify(list);
        if (signature !== last || force) {
          force = false;
          await notifier.sync(list);
          last = signature;
          await recordAction(
            {
              type: 'learning.notificationsPlanned',
              payload: {
                items: list
                  .filter((n) => LEARNED_KINDS.has(n.kind))
                  .map((n) => ({ key: n.key, kind: n.kind, at: new Date(n.at).toISOString() })),
              },
            },
            { db: database },
          );
        }
        return list;
      } catch (error) {
        logError(error, 'notifications.schedule');
        return [];
      }
    });
    return chain;
  };
  const unsubscribe = subscribeAll(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void refresh(), delayMs);
  });
  void refresh();
  active = () => {
    force = true;
    return refresh();
  };
  return {
    stop: () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      active = null;
    },
    refresh,
  };
}
