import { addDays } from '@/core/time';
import { pastDays, testInput, testInstance } from '@/test/adaptiveInput';
import { habitModels } from './habits';
import { testHabit } from '@/test/adaptiveInput';
import { atRiskToday, whatNow, type PendingQuest } from './today';

const TODAY = '2026-11-02'; // Monday

/** "gym" is skipped on Mondays; "read" is always done. */
function setup() {
  const days = pastDays(TODAY, 56);
  const instances = days.flatMap((d) => {
    const monday = new Date(`${d}T12:00:00Z`).getUTCDay() === 1;
    return [
      testInstance('gym', d, monday ? 'missed' : 'done_full', { measure: 'check' }),
      testInstance('read', d, 'done_full'),
    ];
  });
  const input = testInput({ habits: [testHabit('gym'), testHabit('read')], instances });
  return habitModels(input);
}

const pending = (over: Partial<PendingQuest>[]): PendingQuest[] =>
  over.map((o, i) => ({
    instanceId: `i${i}`,
    habitId: 'read',
    title: 'Read',
    measure: 'minutes',
    core: false,
    remainingMin: 15,
    goalDeadline: null,
    ...o,
  }));

describe('at risk today', () => {
  it('flags the quest usually skipped on this weekday, with why', () => {
    const risks = atRiskToday(
      TODAY,
      setup(),
      pending([{ habitId: 'gym', title: 'Gym', measure: 'check' }, { habitId: 'read' }]),
      false,
    );
    expect(risks).toHaveLength(1);
    expect(risks[0]?.instanceId).toBe('i0');
    expect(risks[0]?.why).toMatch(/Often skipped on Mondays/);
  });

  it('a low-energy day flags nothing (no extra pressure)', () => {
    expect(atRiskToday(TODAY, setup(), pending([{ habitId: 'gym' }]), true)).toEqual([]);
  });

  it('another weekday is not at risk', () => {
    expect(atRiskToday(addDays(TODAY, 1), setup(), pending([{ habitId: 'gym' }]), false)).toEqual(
      [],
    );
  });
});

describe('what should I do now?', () => {
  it('prefers a core quest and the one that tends to slip', () => {
    const next = whatNow(
      TODAY,
      10,
      setup(),
      pending([
        { habitId: 'read', title: 'Read' },
        { habitId: 'gym', title: 'Gym', measure: 'check', core: true },
      ]),
      null,
    );
    expect(next?.title).toBe('Gym');
    expect(next?.why).toMatch(/^Core quest/);
    expect(next?.focus).toBe(false);
  });

  it('a goal due soon and the learned focus time pull a minutes quest forward', () => {
    const next = whatNow(
      TODAY,
      6,
      setup(),
      pending([
        { habitId: 'read', title: 'Study', goalDeadline: addDays(TODAY, 5) },
        { habitId: 'x', title: 'Stretch', measure: 'check' },
      ]),
      { start: 5, hours: 2, share: 0.8, n: 20, confidence: 'confident' },
    );
    expect(next?.title).toBe('Study');
    expect(next?.why).toMatch(/due in 5 days/);
    expect(next?.why).toMatch(/best focus time/);
    expect(next?.focus).toBe(true);
  });

  it('nothing pending, nothing suggested', () => {
    expect(whatNow(TODAY, 10, setup(), [], null)).toBeNull();
  });
});
