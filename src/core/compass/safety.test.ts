import { addDays } from '@/core/time';
import { classifyScope } from './scope';
import {
  countryFromTimeZone,
  earliestSafeDate,
  helplineFor,
  lowMoodSupport,
  maxSafeLossPerWeek,
  safetyReply,
  sleepChangeAllowed,
  weightDropWarning,
} from './safety';

const TODAY = '2026-11-30';
const days = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => addDays(TODAY, -(from + i)));

describe('health safety rules (SPEC 6.7 B)', () => {
  it('crisis wording → the helpline straight away (India: Tele-MANAS with the official link)', () => {
    const r = safetyReply(classifyScope('I want to end my life'), 'IN');
    expect(r?.kind).toBe('crisis');
    expect(r?.text).toMatch(/14416/);
    expect(r?.text).toMatch(/telemanas\.mohfw\.gov\.in/);
    expect(safetyReply(classifyScope('I want to die'), null)?.text).toMatch(
      /local emergency number/,
    );
  });

  it('pain, injury, illness or medication → see a doctor, no advice', () => {
    for (const q of [
      'My knee pain is getting worse',
      'Which tablets help me sleep?',
      'I think I have a fever',
    ])
      expect(safetyReply(classifyScope(q), 'IN')?.kind).toBe('medical');
  });

  it('extreme diets, drugs or less sleep are refused with the safe way instead', () => {
    const r = safetyReply(classifyScope('How do I lose 5 kg in a week with a water fast?'), 'IN');
    expect(r?.kind).toBe('extreme');
    expect(r?.text).toMatch(/0\.5–1 kg a week/);
    expect(safetyReply(classifyScope('Can I sleep less to study more?'), 'IN')?.kind).toBe(
      'extreme',
    );
    expect(safetyReply(classifyScope('How many push-ups should a beginner do?'), 'IN')).toBeNull();
  });

  it('safe weight change: at most 1% of body weight and 1 kg a week', () => {
    expect(maxSafeLossPerWeek(70)).toBeCloseTo(0.7);
    expect(maxSafeLossPerWeek(120)).toBe(1);
    expect(earliestSafeDate(80, 72, TODAY)).toBe(addDays(TODAY, 10 * 7));
    expect(earliestSafeDate(70, 75, TODAY)).toBe(TODAY);
  });

  it('warns when weight drops too fast, not at a safe pace', () => {
    const fast = [
      ...days(5).map((d) => ({ day: d, value: 70 })),
      ...days(5, 14).map((d) => ({ day: d, value: 74 })),
    ];
    expect(weightDropWarning(fast, TODAY)).toMatch(/faster than is safe/);
    const safe = [
      ...days(5).map((d) => ({ day: d, value: 73 })),
      ...days(5, 14).map((d) => ({ day: d, value: 74 })),
    ];
    expect(weightDropWarning(safe, TODAY)).toBeNull();
  });

  it('sustained very low mood → gentle support with the helpline; a few low days do not', () => {
    const low = days(8).map((d) => ({ day: d, value: 1 }));
    expect(lowMoodSupport(low, TODAY, 'IN')?.text).toMatch(/talking to someone you trust/);
    expect(lowMoodSupport(low.slice(0, 4), TODAY, 'IN')).toBeNull();
    const ok = days(8).map((d) => ({ day: d, value: 3 }));
    expect(lowMoodSupport(ok, TODAY, 'IN')).toBeNull();
  });

  it('never less sleep; helpline by timezone', () => {
    expect(sleepChangeAllowed(7.5, 7)).toBe(false);
    expect(sleepChangeAllowed(7, 7.5)).toBe(true);
    expect(countryFromTimeZone('Asia/Calcutta')).toBe('IN');
    expect(helplineFor('IN')?.verified).toBeNull(); // shown with its official link
  });
});
