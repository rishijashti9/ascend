import { higherStatus, progressValue, statusForValue } from './progress';

const e = (source: string, amount: number, at: string, deleted = false) => ({
  source: source as 'manual',
  amount,
  occurred_at: `2026-11-02T${at}:00.000Z`,
  deleted_at: deleted ? 'x' : null,
});

describe('progressValue', () => {
  it('minutes and counts add up from every source', () => {
    expect(
      progressValue('minutes', [
        e('focus', 50, '03:00'),
        e('manual', 25, '05:00'),
        e('focus', 25, '06:00'),
      ]),
    ).toBe(100);
    expect(progressValue('count', [e('manual', 3, '03:00'), e('manual', 2, '04:00')])).toBe(5);
  });

  it('never goes below zero and ignores deleted entries', () => {
    expect(progressValue('minutes', [e('manual', 10, '03:00'), e('manual', -30, '04:00')])).toBe(0);
    expect(
      progressValue('minutes', [e('manual', 10, '03:00'), e('manual', 99, '04:00', true)]),
    ).toBe(10);
  });

  it('steps and sleep are totals: latest manual entry wins', () => {
    expect(progressValue('sleep_hours', [e('manual', 7, '01:00'), e('manual', 7.5, '02:00')])).toBe(
      7.5,
    );
    expect(
      progressValue('steps', [
        e('health_connect', 4000, '05:00'),
        e('health_connect', 9000, '12:00'),
      ]),
    ).toBe(9000);
    expect(
      progressValue('steps', [e('health_connect', 9000, '12:00'), e('manual', 6000, '06:00')]),
    ).toBe(6000);
  });

  it('check quests have no numeric progress', () => {
    expect(progressValue('check', [e('manual', 5, '01:00')])).toBe(0);
  });
});

describe('statusForValue / higherStatus', () => {
  it('maps values to statuses', () => {
    expect(statusForValue(10, 150, 30)).toBe('pending');
    expect(statusForValue(30, 150, 30)).toBe('done_min');
    expect(statusForValue(150, 150, 30)).toBe('done_full');
  });

  it('never downgrades', () => {
    expect(higherStatus('done_full', 'done_min')).toBe('done_full');
    expect(higherStatus('done_min', 'done_full')).toBe('done_full');
    expect(higherStatus('pending', 'done_min')).toBe('done_min');
  });
});
