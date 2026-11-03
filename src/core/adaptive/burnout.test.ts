import { addDays } from '@/core/time';
import { pastDays, testInput, testInstance } from '@/test/adaptiveInput';
import { createTestDb } from '@/test/testDb';
import { burnoutWarning } from './burnout';

const TODAY = '2026-11-30';

/** 28 days of 4 quests: first two weeks `before` done, last two weeks `after` done. */
function slipping(before: number, after: number) {
  return pastDays(TODAY, 28).flatMap((d, i) =>
    [0, 1, 2, 3].map((k) =>
      testInstance(`h${k}`, d, k < (i < 14 ? before : after) ? 'done_full' : 'missed'),
    ),
  );
}

describe('early burnout warning (SPEC 6.7 A)', () => {
  it('slipping completion plus low-energy days → a gentle warning that names both', () => {
    const w = burnoutWarning(
      testInput({
        today: TODAY,
        instances: slipping(4, 2),
        lowEnergyDays: [1, 3, 5].map((k) => addDays(TODAY, -k)),
      }),
      7.5,
    );
    expect(w?.signals.map((s) => s.key)).toEqual(['slipping', 'low_energy']);
    expect(w?.why).toMatch(/completion has slipped from 100% to 50% and 3 low-energy days/);
    expect(w?.why).toMatch(/Sleep comes first/);
  });

  it('one signal alone is not enough', () => {
    expect(burnoutWarning(testInput({ today: TODAY, instances: slipping(4, 2) }), 7.5)).toBeNull();
  });

  it('short sleep and low check-in energy count too', () => {
    const days = pastDays(TODAY, 6);
    const w = burnoutWarning(
      testInput({
        today: TODAY,
        sleep: days.map((d) => ({ day: d, value: 5.5 })),
        energy: days.slice(0, 4).map((d) => ({ day: d, value: 2 })),
      }),
      7.5,
    );
    expect(w?.signals.map((s) => s.key)).toEqual(['short_sleep', 'low_energy_checkins']);
  });
});

describe('make this week lighter', () => {
  it('shrinks numeric quests (core less), never sleep or below minimum, with Undo', async () => {
    const t = await createTestDb();
    try {
      const make = (title: string, measure: string, target: number, min: number) =>
        t.run<{ id: string }>({
          type: 'habit.create',
          payload: {
            title,
            stat: 'INT',
            difficulty: 'normal',
            measure,
            target_value: target,
            min_value: min,
          },
        });
      const study = (await make('Study', 'minutes', 120, 30)).value as { id: string };
      const sleep = (await make('Sleep', 'sleep_hours', 7.5, 6.5)).value as { id: string };
      const tiny = (await make('Read', 'minutes', 10, 10)).value as { id: string };
      const r = await t.run<{ id: string; summary: string }>({
        type: 'adaptive.lighterWeek',
        payload: {},
      });
      expect((await t.db.habits.get(study.id))?.target_value).toBe(90);
      expect((await t.db.habits.get(sleep.id))?.target_value).toBe(7.5);
      expect((await t.db.habits.get(tiny.id))?.target_value).toBe(10);
      expect(r.value?.summary).toMatch(/A lighter week: 1 daily quest made smaller/);
      await t.run({ type: 'plan.undo', payload: { id: r.value?.id } });
      expect((await t.db.habits.get(study.id))?.target_value).toBe(120);
    } finally {
      await t.cleanup();
    }
  });
});
