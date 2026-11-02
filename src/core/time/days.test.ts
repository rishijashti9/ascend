import {
  addDays,
  dayBounds,
  dayNumber,
  dayOf,
  daysBetween,
  diffDays,
  instantAt,
  isValidDay,
  parseDay,
  parseTime,
  timeZoneOffsetMs,
  weekStartOf,
  weekdayOf,
} from './days';

const KOLKATA = 'Asia/Kolkata'; // UTC+5:30, no DST
const BERLIN = 'Europe/Berlin'; // CET/CEST, has DST
const H = 3_600_000;

/** Instant for a Kolkata wall time (IST = UTC+5:30). */
const ist = (y: number, mo: number, d: number, h: number, mi = 0) =>
  Date.UTC(y, mo - 1, d, h, mi) - 5.5 * H;

describe('dayOf — midnight and day-start hour', () => {
  it('23:59 and 00:01 are the same day when the day starts at 3:00', () => {
    expect(dayOf(ist(2026, 11, 2, 23, 59), KOLKATA, 3)).toBe('2026-11-02');
    expect(dayOf(ist(2026, 11, 3, 0, 1), KOLKATA, 3)).toBe('2026-11-02');
  });

  it('switches exactly at the day-start hour', () => {
    expect(dayOf(ist(2026, 11, 3, 2, 59), KOLKATA, 3)).toBe('2026-11-02');
    expect(dayOf(ist(2026, 11, 3, 3, 0), KOLKATA, 3)).toBe('2026-11-03');
  });

  it('with day-start 0 the day switches at midnight', () => {
    expect(dayOf(ist(2026, 11, 2, 23, 59), KOLKATA, 0)).toBe('2026-11-02');
    expect(dayOf(ist(2026, 11, 3, 0, 0), KOLKATA, 0)).toBe('2026-11-03');
  });

  it('crosses month and year boundaries', () => {
    expect(dayOf(ist(2027, 1, 1, 1, 0), KOLKATA, 3)).toBe('2026-12-31');
    expect(dayOf(ist(2027, 1, 1, 4, 0), KOLKATA, 3)).toBe('2027-01-01');
  });
});

describe('dayOf — timezone changes', () => {
  it('the same instant can be different days in different timezones', () => {
    const instant = Date.UTC(2026, 10, 2, 22, 0); // 03:30 Nov 3 IST, 23:00 Nov 2 CET
    expect(dayOf(instant, KOLKATA, 3)).toBe('2026-11-03');
    expect(dayOf(instant, BERLIN, 3)).toBe('2026-11-02');
  });

  it('a day string computed earlier never changes (it is just stored text)', () => {
    const stored = dayOf(ist(2026, 11, 2, 9, 0), KOLKATA, 3);
    // Moving to Berlin later does not touch stored values; new actions use the new zone.
    expect(stored).toBe('2026-11-02');
    expect(dayOf(Date.UTC(2026, 10, 10, 9, 0), BERLIN, 3)).toBe('2026-11-10');
  });

  it('reports UTC offsets', () => {
    expect(timeZoneOffsetMs(Date.UTC(2026, 10, 2), KOLKATA)).toBe(5.5 * H);
    expect(timeZoneOffsetMs(Date.UTC(2027, 0, 15), BERLIN)).toBe(1 * H);
    expect(timeZoneOffsetMs(Date.UTC(2027, 6, 15), BERLIN)).toBe(2 * H);
  });
});

describe('leap years', () => {
  it('validates Feb 29 correctly', () => {
    expect(isValidDay('2028-02-29')).toBe(true);
    expect(isValidDay('2027-02-29')).toBe(false);
    expect(isValidDay('2000-02-29')).toBe(true);
    expect(isValidDay('2100-02-29')).toBe(false);
  });

  it('adds days across Feb 29', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts 366 days in a leap year', () => {
    expect(diffDays('2028-01-01', '2029-01-01')).toBe(366);
    expect(diffDays('2027-01-01', '2028-01-01')).toBe(365);
  });

  it('1 AM on March 1 belongs to Feb 29 with a 3 AM day start', () => {
    expect(dayOf(ist(2028, 3, 1, 1, 0), KOLKATA, 3)).toBe('2028-02-29');
  });
});

describe('DST (Europe/Berlin)', () => {
  it('spring-forward day has 23 hours when the day starts before the switch', () => {
    const { start, end } = dayBounds('2027-03-27', BERLIN, 3);
    expect((end - start) / H).toBe(23);
  });

  it('fall-back: both 02:30s belong to the previous day with a 3 AM day start', () => {
    expect(dayOf(Date.UTC(2027, 9, 31, 0, 30), BERLIN, 3)).toBe('2027-10-30'); // 02:30 CEST
    expect(dayOf(Date.UTC(2027, 9, 31, 1, 30), BERLIN, 3)).toBe('2027-10-30'); // 02:30 CET
    expect(dayOf(Date.UTC(2027, 9, 31, 2, 0), BERLIN, 3)).toBe('2027-10-31'); // 03:00 CET
  });

  it('a wall time inside the DST gap is shifted forward by the gap', () => {
    // 02:30 doesn't exist on 2027-03-28 in Berlin; it becomes 03:30 CEST (01:30 UTC).
    expect(instantAt('2027-03-28', '02:30', BERLIN)).toBe(Date.UTC(2027, 2, 28, 1, 30));
  });
});

describe('instantAt and dayBounds', () => {
  it('finds the instant of a local wall time', () => {
    expect(instantAt('2026-11-03', '05:00', KOLKATA)).toBe(ist(2026, 11, 3, 5, 0));
    expect(instantAt('2027-07-01', '05:00', BERLIN)).toBe(Date.UTC(2027, 6, 1, 3, 0));
  });

  it('day bounds run from day-start to next day-start', () => {
    const { start, end } = dayBounds('2026-11-02', KOLKATA, 3);
    expect(start).toBe(ist(2026, 11, 2, 3, 0));
    expect(end).toBe(ist(2026, 11, 3, 3, 0));
    expect(dayOf(start, KOLKATA, 3)).toBe('2026-11-02');
    expect(dayOf(end - 1, KOLKATA, 3)).toBe('2026-11-02');
    expect(dayOf(end, KOLKATA, 3)).toBe('2026-11-03');
  });
});

describe('weeks and day numbers', () => {
  it('weekday of a date', () => {
    expect(weekdayOf('2026-11-02')).toBe(1); // Monday
    expect(weekdayOf('2026-11-08')).toBe(0); // Sunday
  });

  it('week start on Monday (default) and Sunday', () => {
    expect(weekStartOf('2026-11-02')).toBe('2026-11-02');
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02');
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-08', 0)).toBe('2026-11-08');
    expect(weekStartOf('2026-11-07', 0)).toBe('2026-11-01');
  });

  it('week start across a year boundary', () => {
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28');
  });

  it('Day N counts from 1 on the start day', () => {
    expect(dayNumber('2026-11-02', '2026-11-02')).toBe(1);
    expect(dayNumber('2026-11-02', '2026-11-03')).toBe(2);
    expect(dayNumber('2026-11-02', '2027-11-02')).toBe(366);
  });

  it('lists days inclusively', () => {
    expect(daysBetween('2028-02-27', '2028-03-01')).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
    expect(daysBetween('2026-11-03', '2026-11-02')).toEqual([]);
  });
});

describe('parsing', () => {
  it('rejects invalid day strings', () => {
    expect(() => parseDay('2026-13-01')).toThrow();
    expect(() => parseDay('2026-1-1')).toThrow();
    expect(() => parseDay('nonsense')).toThrow();
  });

  it('parses HH:MM times', () => {
    expect(parseTime('05:00')).toBe(300);
    expect(parseTime('7:20')).toBe(440);
    expect(() => parseTime('24:00')).toThrow();
    expect(() => parseTime('05:60')).toThrow();
  });
});
