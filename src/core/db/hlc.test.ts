import { resetClock, setNow } from '@/core/time';
import { getDeviceId, nextHlc, observeHlc, parseHlc } from './hlc';

afterEach(() => resetClock());

describe('hybrid logical clock', () => {
  it('is strictly increasing, even within the same millisecond', () => {
    setNow(Date.UTC(2026, 10, 2));
    const values = Array.from({ length: 50 }, () => nextHlc());
    const sorted = [...values].sort();
    expect(values).toEqual(sorted);
    expect(new Set(values).size).toBe(50);
  });

  it('never goes backwards when the clock is moved back', () => {
    setNow(Date.UTC(2030, 0, 1));
    const later = nextHlc();
    setNow(Date.UTC(2026, 0, 1));
    expect(nextHlc() > later).toBe(true);
  });

  it('local writes after observing a remote timestamp sort after it', () => {
    setNow(Date.UTC(2026, 10, 2));
    const remote = `${String(Date.UTC(2027, 0, 1)).padStart(15, '0')}-0003-remote01`;
    observeHlc(remote);
    expect(nextHlc() > remote).toBe(true);
  });

  it('parses its own format and uses a stable device id', () => {
    const parsed = parseHlc(nextHlc());
    expect(parsed.device).toBe(getDeviceId());
    expect(getDeviceId()).toBe(getDeviceId());
    expect(Number.isFinite(parsed.ms)).toBe(true);
  });
});
