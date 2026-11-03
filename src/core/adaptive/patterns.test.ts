import { addDays } from '@/core/time';
import { ist } from '@/test/testDb';
import { pastDays, testEvent, testInput, testInstance } from '@/test/adaptiveInput';
import {
  completionWindow,
  focusWindow,
  mayShow,
  suggestionWelcome,
  weeklyCapacity,
} from './patterns';

const TODAY = '2026-11-02'; // a Monday
const at = (day: string, h: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(ist(y ?? 0, m ?? 0, d ?? 0, h)).toISOString();
};

describe('best hours', () => {
  it('finds the 2-hour window where focus really happens (local time)', () => {
    const days = pastDays(TODAY, 20);
    const focus = days.flatMap((d, i) => [
      { day: d, startedAt: at(d, 6), minutes: 50, linked: true },
      ...(i % 4 === 0 ? [{ day: d, startedAt: at(d, 20), minutes: 25, linked: false }] : []),
    ]);
    const w = focusWindow(testInput({ focus }));
    expect(w?.start).toBe(5); // 5–7 (the 6:00 sessions sit inside it)
    expect(w?.share).toBeGreaterThan(0.8);
    expect(w?.confidence).toBe('confident');
  });

  it('no data, no window', () => {
    expect(focusWindow(testInput())).toBeNull();
  });

  it('scattered completions are only an early guess', () => {
    const days = pastDays(TODAY, 24);
    const instances = days.map((d, i) =>
      testInstance('h', d, 'done_full', { completedAt: at(d, i % 24) }),
    );
    expect(completionWindow(testInput({ instances }))?.confidence).toBe('early');
  });
});

describe('real weekly capacity', () => {
  it('compares minutes really done per week with what the quests asked for', () => {
    const days = pastDays(TODAY, 28); // four full weeks
    const instances = days.map((d) => testInstance('h', d, 'done_min', { target: 60, value: 30 }));
    const c = weeklyCapacity(testInput({ instances }));
    expect(c?.plannedMinutes).toBe(420);
    expect(c?.doneMinutes).toBe(210);
    expect(c?.ratio).toBeCloseTo(0.5);
    expect(c?.weeks).toBe(4);
    expect(c?.confidence).toBe('confident');
  });

  it('this week (not finished) does not count; unlinked focus does', () => {
    const instances = [testInstance('h', TODAY, 'done_full', { target: 60, value: 60 })];
    const focus = [
      { day: addDays(TODAY, -3), startedAt: at(TODAY, 6), minutes: 40, linked: false },
    ];
    const c = weeklyCapacity(testInput({ instances, focus }));
    expect(c?.doneMinutes).toBe(40);
    expect(c?.weeks).toBe(1);
  });
});

describe('how welcome a suggestion type is', () => {
  const answers = (type: string, outcome: 'accepted' | 'rejected' | 'ignored', n: number) =>
    pastDays(TODAY, n).map((day) => testEvent({ type, outcome, day }));

  it('a type rejected again and again comes back less often, never less than weekly', () => {
    const events = answers('plan_weekly', 'rejected', 10);
    const w = suggestionWelcome(testInput({ events }), 'plan_weekly');
    expect(w.estimate.p).toBeLessThan(0.25);
    expect(w.everyDays).toBeGreaterThan(1);
    expect(w.everyDays).toBeLessThanOrEqual(7);
  });

  it('a welcome type shows whenever it applies', () => {
    const events = answers('goal_risk', 'accepted', 6);
    expect(suggestionWelcome(testInput({ events }), 'goal_risk').everyDays).toBe(1);
  });

  it('mayShow waits the gap after the last time it was shown', () => {
    const events = [
      ...answers('difficulty_raise', 'rejected', 10),
      testEvent({ type: 'difficulty_raise', outcome: 'shown', day: addDays(TODAY, -1) }),
    ];
    expect(mayShow(testInput({ events }), 'difficulty_raise')).toBe(false);
    expect(mayShow(testInput({ events, today: addDays(TODAY, 10) }), 'difficulty_raise')).toBe(
      true,
    );
  });
});
