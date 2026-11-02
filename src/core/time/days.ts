/**
 * Calendar-day logic. A "day" is a local date string `YYYY-MM-DD` that runs from the
 * day-start hour (e.g. 3:00) to the next day's day-start hour, in a given timezone.
 * Day strings are computed once, at the moment of an action, and stored — never recomputed.
 *
 * Date strings are handled with pure arithmetic on UTC dates, so they never shift
 * with the device timezone or DST.
 */

/** A local calendar date, `YYYY-MM-DD`. */
export type DayString = string;

/** 0 = Sunday … 6 = Saturday (same as JS `getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

// ---- Local wall-clock parts of an instant in a timezone ----

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

export interface LocalParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
}

export function localParts(instant: Date | number, tz: string): LocalParts {
  const parts = formatterFor(tz).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset of `tz` from UTC at `instant`, in milliseconds (e.g. +5:30 → 19 800 000). */
export function timeZoneOffsetMs(instant: Date | number, tz: string): number {
  const ms = typeof instant === 'number' ? instant : instant.getTime();
  const p = localParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

// ---- Day strings ----

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export function formatDay(year: number, month: number, day: number): DayString {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parseDay(day: DayString): { year: number; month: number; day: number } {
  const m = DAY_RE.exec(day);
  if (!m || !isValidDay(day)) throw new Error(`Invalid day string: "${day}"`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function isValidDay(day: string): boolean {
  const m = DAY_RE.exec(day);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function dayToUtcMs(day: DayString): number {
  const { year, month, day: d } = parseDay(day);
  return Date.UTC(year, month - 1, d);
}

function utcMsToDay(ms: number): DayString {
  const date = new Date(ms);
  return formatDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Which app-day an instant belongs to: its local date in `tz`, minus one day if the
 * local time is before `dayStartHour` (so 1:30 AM still counts as the previous day).
 */
export function dayOf(instant: Date | number, tz: string, dayStartHour: number): DayString {
  const p = localParts(instant, tz);
  const calendarDay = formatDay(p.year, p.month, p.day);
  return p.hour < dayStartHour ? addDays(calendarDay, -1) : calendarDay;
}

export function addDays(day: DayString, n: number): DayString {
  return utcMsToDay(dayToUtcMs(day) + n * MS_PER_DAY);
}

/** Whole days from `a` to `b` (positive if b is later). */
export function diffDays(a: DayString, b: DayString): number {
  return Math.round((dayToUtcMs(b) - dayToUtcMs(a)) / MS_PER_DAY);
}

export function weekdayOf(day: DayString): Weekday {
  return new Date(dayToUtcMs(day)).getUTCDay() as Weekday;
}

/** First day of the week containing `day`. `weekStartsOn` 1 = Monday (default), 0 = Sunday. */
export function weekStartOf(day: DayString, weekStartsOn: Weekday = 1): DayString {
  const back = (weekdayOf(day) - weekStartsOn + 7) % 7;
  return addDays(day, -back);
}

/** "Day N": day 1 is the start day. */
export function dayNumber(startDay: DayString, day: DayString): number {
  return diffDays(startDay, day) + 1;
}

/** Every day from `from` to `to`, inclusive. Empty if `to` is before `from`. */
export function daysBetween(from: DayString, to: DayString): DayString[] {
  const n = diffDays(from, to);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(from, i));
}

export function compareDays(a: DayString, b: DayString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---- Local wall time → instant ----

/** Parses "HH:MM" into minutes after midnight. */
export function parseTime(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  const h = Number(m?.[1]);
  const min = Number(m?.[2]);
  if (!m || h > 23 || min > 59) throw new Error(`Invalid time: "${hhmm}"`);
  return h * 60 + min;
}

/**
 * The instant when the clock in `tz` shows `hhmm` on calendar date `date`.
 * If that wall time doesn't exist (DST gap), it is shifted forward by the length of the gap
 * (02:30 in a 1-hour gap → 03:30), the same rule as JavaScript Temporal's "compatible" mode.
 */
export function instantAt(date: DayString, hhmm: string, tz: string): number {
  const { year, month, day } = parseDay(date);
  const minutes = parseTime(hhmm);
  const wallAsUtc = Date.UTC(year, month - 1, day, 0, minutes);
  // Two passes handle offsets that change around the target time.
  let guess = wallAsUtc - timeZoneOffsetMs(wallAsUtc, tz);
  guess = wallAsUtc - timeZoneOffsetMs(guess, tz);
  const p = localParts(guess, tz);
  const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  if (shownAsUtc < wallAsUtc) {
    // Inside a DST gap: move forward by the missing amount.
    guess += wallAsUtc - shownAsUtc;
  }
  return guess;
}

/** Start (inclusive) and end (exclusive) instants of an app-day. */
export function dayBounds(
  day: DayString,
  tz: string,
  dayStartHour: number,
): { start: number; end: number } {
  const hh = `${pad(dayStartHour)}:00`;
  return { start: instantAt(day, hh, tz), end: instantAt(addDays(day, 1), hh, tz) };
}
