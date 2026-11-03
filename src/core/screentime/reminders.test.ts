import { describe, expect, it } from 'vitest';
import { instantAt } from '@/core/time';
import {
  activeCase,
  canTakeBreak,
  nextCheckMs,
  reminderStep,
  reminderText,
  type ReminderInput,
  type ReminderState,
} from './reminders';

const tz = 'Asia/Kolkata';
const at = (hhmm: string, day = '2026-11-04') => instantAt(day, hhmm, tz);

const input = (over: Partial<ReminderInput> = {}): ReminderInput => ({
  nowMs: at('15:00'),
  tz,
  dayStartHour: 3,
  windDown: '21:00',
  quietHours: { start: '22:00', end: '04:45' },
  entertainmentSec: 0,
  limitMin: 60,
  remindersOn: true,
  breakUntilMs: null,
  ...over,
});

describe('when reminders apply', () => {
  it('only over the limit or after wind-down (until the day-start hour)', () => {
    expect(activeCase(input({ entertainmentSec: 59 * 60 }))).toBeNull();
    expect(activeCase(input({ entertainmentSec: 60 * 60 }))).toBe('over_limit');
    expect(activeCase(input({ nowMs: at('21:00') }))).toBe('wind_down');
    expect(activeCase(input({ nowMs: at('02:30', '2026-11-05') }))).toBe('wind_down');
    expect(activeCase(input({ nowMs: at('03:00', '2026-11-05') }))).toBeNull();
    // Over the limit wins.
    expect(activeCase(input({ nowMs: at('22:00'), entertainmentSec: 4000 }))).toBe('over_limit');
  });

  it('never while reminders are off, during a break, or with no limit before wind-down', () => {
    expect(activeCase(input({ remindersOn: false, entertainmentSec: 9999 }))).toBeNull();
    expect(activeCase(input({ entertainmentSec: 9999, breakUntilMs: at('15:10') }))).toBeNull();
    expect(activeCase(input({ entertainmentSec: 9999, breakUntilMs: at('14:59') }))).toBe(
      'over_limit',
    );
    expect(activeCase(input({ limitMin: null, entertainmentSec: 9999 }))).toBeNull();
  });

  it('breaks: at most 2 a day', () => {
    expect(canTakeBreak(0)).toBe(true);
    expect(canTakeBreak(1)).toBe(true);
    expect(canTakeBreak(2)).toBe(false);
  });
});

describe('no background checking: when the service wakes next', () => {
  it('at the earliest moment the allowance could run out, or wind-down, whichever first', () => {
    const wind = at('21:00');
    expect(nextCheckMs(input({ entertainmentSec: 40 * 60 }), wind)).toBe(at('15:20'));
    expect(nextCheckMs(input({ nowMs: at('20:50') }), wind)).toBe(wind);
    expect(nextCheckMs(input({ limitMin: null }), wind)).toBe(wind);
    expect(nextCheckMs(input({ remindersOn: false }), wind)).toBeNull();
    expect(nextCheckMs(input({ breakUntilMs: at('15:05') }), wind)).toBe(at('15:05'));
  });
});

describe('the notification: first, then every minute, one notification', () => {
  const over = input({ entertainmentSec: 3700 });
  const empty: ReminderState = { stretchStartMs: null, lastAlertMs: null };

  it('first alert at once, re-alert every 1 minute while still on entertainment', () => {
    const s1 = reminderStep(over, true, empty);
    expect(s1).toMatchObject({ alert: true, first: true, silent: false });
    const s2 = reminderStep({ ...over, nowMs: over.nowMs + 30_000 }, true, s1.state);
    expect(s2.alert).toBe(false);
    const s3 = reminderStep({ ...over, nowMs: over.nowMs + 60_000 }, true, s2.state);
    expect(s3).toMatchObject({ alert: true, first: false });
    expect(s3.state.stretchStartMs).toBe(over.nowMs);
  });

  it('leaving the app clears it; nothing at all on work apps', () => {
    const s1 = reminderStep(over, true, empty);
    expect(reminderStep(over, false, s1.state)).toMatchObject({ clear: true, alert: false });
    expect(reminderStep(over, false, empty)).toMatchObject({ clear: false, alert: false });
  });

  it('quiet hours: still updates, silently', () => {
    const late = input({ nowMs: at('23:00'), entertainmentSec: 0 });
    expect(reminderStep(late, true, empty)).toMatchObject({ alert: true, silent: true });
  });

  it('calm wording with the time spent, never shaming', () => {
    const t = reminderText('over_limit', {
      appName: 'Instagram',
      first: false,
      stretchMin: 7,
      overMin: 12,
      windDown: '21:00',
    });
    expect(t.title).toBe('7 min on Instagram');
    expect(t.body).toContain('12 min past today’s limit');
    const all = JSON.stringify([
      t,
      reminderText('wind_down', {
        appName: 'YouTube',
        first: true,
        stretchMin: 0,
        overMin: 0,
        windDown: '21:00',
      }),
    ]).toLowerCase();
    for (const word of ['fail', 'lazy', 'shame', 'wasted', 'bad']) expect(all).not.toContain(word);
  });
});
