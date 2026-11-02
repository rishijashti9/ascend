import { db as appDb, type AscendDB } from '@/core/db/db';
import { isRecoveryId, recoveryQuestId } from '@/core/engine/instances';
import { recordAction, type Action } from '@/core/pipeline';
import { addDays, currentTimeZone, dayOf, instantAt, nowMs, setNow } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';

/**
 * Dev-only test data (SPEC 0.10): wipes the local database and lives N days of realistic
 * history through the REAL actions (onboarding, rollover, completions, low energy, Recovery
 * quests), moving the clock day by day. Same behaviour model as scripts/simulate.ts, so the
 * result looks like real use. Ends at the time it started (today is left untouched).
 */
export const MODEL = {
  coreDoneChance: 0.9,
  otherDoneChance: 0.72,
  fullShare: 0.75,
  lowEnergyChance: 0.1,
  onTimeWakeShare: 0.8,
  breaksPerYear: 2,
  breakLength: [4, 13] as const,
  recoveryDoneChance: 0.7,
};

/** Small deterministic RNG so the same seed gives the same history. */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export interface GenerateOptions {
  days: number;
  seed?: number;
  database?: AscendDB;
  onProgress?: (done: number, total: number) => void;
}

export async function generateHistory({
  days,
  seed = 1,
  database = appDb,
  onProgress,
}: GenerateOptions): Promise<void> {
  const run = (action: Action) => recordAction(action, { db: database });
  const r = rng(seed);
  const tz = currentTimeZone();
  const end = nowMs();

  database.close();
  await database.delete();
  await database.open();
  const dayStart = (await database.settings.get('settings'))?.day_start_hour ?? 3;
  const today = dayOf(end, tz, dayStart);
  const first = addDays(today, -days);
  const at = (day: string, hhmm: string) => new Date(instantAt(day, hhmm, tz)).toISOString();

  setNow(instantAt(first, '10:00', tz));
  await run({
    type: 'onboarding.complete',
    payload: {
      name: 'Rishi',
      wake_time: '05:00',
      theme: 'system',
      start: 'today',
      habits: STARTER_HABITS.filter((h) => h.selected).map(habitFieldsOf),
      dream: null,
      main_quests: [],
    },
  });

  let breakLeft = 0;
  for (let i = 1; i < days; i++) {
    onProgress?.(i, days);
    const day = addDays(first, i);
    if (breakLeft > 0) breakLeft--;
    else if (r() < MODEL.breaksPerYear / 365) {
      const [lo, hi] = MODEL.breakLength;
      breakLeft = lo + Math.floor(r() * (hi - lo + 1)) - 1;
    }
    if (breakLeft > 0) continue; // away: the app isn't opened that day

    setNow(instantAt(day, '04:30', tz));
    await run({ type: 'day.rollover', payload: {}, source: 'rollover' });
    setNow(instantAt(day, '21:00', tz));

    const lowEnergy = r() < MODEL.lowEnergyChance;
    if (lowEnergy) await run({ type: 'day.setLowEnergy', payload: { on: true } });

    // In the order Rishi set (ids are random, so id order would change the random draws).
    const order = new Map((await database.habits.toArray()).map((h) => [h.id, h.order]));
    const instances = (await database.quest_instances.where('day').equals(day).toArray())
      .filter((q) => q.deleted_at === null)
      .sort((a, b) => (order.get(a.source_id) ?? 99) - (order.get(b.source_id) ?? 99));
    for (const q of instances) {
      if (isRecoveryId(q.id)) continue;
      if (lowEnergy && !q.core_snapshot) continue;
      if (r() >= (q.core_snapshot ? MODEL.coreDoneChance : MODEL.otherDoneChance)) continue;
      const full = !lowEnergy && r() < MODEL.fullShare;
      const instanceId = q.id;
      if (q.auto_source_snapshot === 'wake_checkin') {
        const onTime = r() < MODEL.onTimeWakeShare;
        await run({
          type: 'quest.wakeCheckin',
          payload: { instanceId },
          occurred_at: at(day, onTime ? '05:10' : '06:30'),
        });
      } else if (q.measure_snapshot === 'check') {
        await run({
          type: 'quest.complete',
          payload: { instanceId, version: full ? 'full' : 'min' },
        });
      } else {
        const amount = (full ? q.target_snapshot : q.min_snapshot) ?? 0;
        await run({ type: 'quest.logProgress', payload: { instanceId, amount } });
      }
    }
    const recovery = instances.find((q) => q.id === recoveryQuestId(day));
    if (recovery && r() < MODEL.recoveryDoneChance) {
      await run({ type: 'quest.complete', payload: { instanceId: recovery.id, version: 'full' } });
    }
  }

  setNow(end);
  await run({ type: 'day.rollover', payload: {}, source: 'rollover' });
  onProgress?.(days, days);
}
