import type { Habit } from '@/core/db/types';
import { setNow } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { createTestDb, ist } from '@/test/testDb';
import { ensureInstancesForDay, RuleError } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';

beforeEach(async () => {
  t = await createTestDb(ist(2026, 11, 2, 4));
});
afterEach(() => t.cleanup());

const wakeFields = () => {
  const wake = STARTER_HABITS.find((h) => h.auto_source === 'wake_checkin');
  if (!wake) throw new Error('no wake habit');
  return habitFieldsOf(wake);
};

async function wakeHabit(): Promise<string> {
  const h = (await t.run<Habit>({ type: 'habit.create', payload: wakeFields() })).value as Habit;
  await ensureInstancesForDay(t.db, DAY);
  return h.id;
}

const update = (payload: object) => t.run({ type: 'settings.update', payload });

describe('settings.update', () => {
  it('changes only the given fields', async () => {
    await update({ theme: 'dark', day_start_hour: 4 });
    expect(await t.db.settings.get('settings')).toMatchObject({
      theme: 'dark',
      day_start_hour: 4,
      wake_time: '05:00',
    });
  });

  it('the wake-up quest wording follows the wake settings (today too, while pending)', async () => {
    const id = await wakeHabit();
    await update({ wake_time: '06:00', wake_window_min: 15, wake_late_cutoff: '08:00' });
    expect(await t.db.habits.get(id)).toMatchObject({
      full_version: '"I\'m up" by 6:15 AM',
      min_version: 'Late check-in (by 8:00 AM)',
    });
    expect((await t.db.quest_instances.get(`${id}:${DAY}`))?.full_version_snapshot).toBe(
      '"I\'m up" by 6:15 AM',
    );
  });

  it('a wake-up already checked in today keeps its wording', async () => {
    const id = await wakeHabit();
    setNow(ist(2026, 11, 2, 5, 10));
    await t.run({ type: 'quest.wakeCheckin', payload: { instanceId: `${id}:${DAY}` } });
    await update({ wake_time: '06:00' });
    expect((await t.db.quest_instances.get(`${id}:${DAY}`))?.full_version_snapshot).toBe(
      '"I\'m up" by 5:20 AM',
    );
  });

  it('rejects a late cutoff that is not after the on-time window', async () => {
    await expect(update({ wake_time: '06:50' })).rejects.toThrow(RuleError);
    await expect(update({ wake_late_cutoff: '05:20' })).rejects.toThrow(/late cutoff/);
    expect((await t.db.settings.get('settings'))?.wake_time).toBe('05:00');
  });
});
