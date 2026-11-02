import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { appDayOf, getSettings, isoNow, subscribeAll } from '@/core/pipeline';
import { currentTimeZone, nowMs } from '@/core/time';
import { planNotifications, type PlanInput } from './plan';
import type { Notifier, PlannedNotification } from './types';

/** Reads everything the planner needs. */
export async function loadPlanInput(database: AscendDB): Promise<PlanInput> {
  return database.transaction(
    'r',
    ['settings', 'profile', 'habits', 'quest_instances', 'reviews'],
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<PlannedNotification[]> = Promise.resolve([]);

  const refresh = () => {
    chain = chain.then(async () => {
      try {
        const list = planNotifications(await loadPlanInput(database));
        const signature = JSON.stringify(list);
        if (signature !== last) {
          await notifier.sync(list);
          last = signature;
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
  return {
    stop: () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    },
    refresh,
  };
}
