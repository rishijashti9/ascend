import {
  currentTimeZone,
  getClockOffset,
  isValidTimeZone,
  now,
  resetClock,
  setClockOffset,
  setNow,
  setTimeZoneOverride,
} from './clock';

describe('clock', () => {
  afterEach(() => resetClock());

  it('returns real time with no offset', () => {
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(50);
  });

  it('applies an offset', () => {
    setClockOffset(86_400_000);
    expect(Math.abs(now().getTime() - (Date.now() + 86_400_000))).toBeLessThan(50);
  });

  it('setNow travels to an exact instant', () => {
    const target = Date.UTC(2030, 0, 1, 12, 0);
    setNow(target);
    expect(Math.abs(now().getTime() - target)).toBeLessThan(50);
  });

  it('timezone override for testing timezone changes', () => {
    setTimeZoneOverride('Europe/Berlin');
    expect(currentTimeZone()).toBe('Europe/Berlin');
    resetClock();
    expect(currentTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(getClockOffset()).toBe(0);
  });

  it('rejects unknown timezones', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(() => setTimeZoneOverride('Mars/Olympus')).toThrow();
  });
});
