import { clearErrorLog, formatErrorLog, getErrorLog, logError, scrubSecrets } from './errorLog';

describe('errorLog', () => {
  beforeEach(() => {
    clearErrorLog();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('stores an entry with message, context and version', () => {
    logError(new Error('boom'), 'test');
    const [entry] = getErrorLog();
    expect(entry?.message).toBe('boom');
    expect(entry?.context).toBe('test');
    expect(entry?.appVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('accepts non-Error values', () => {
    logError('plain string');
    expect(getErrorLog()[0]?.message).toBe('plain string');
  });

  it('keeps only the newest 100 entries', () => {
    for (let i = 0; i < 105; i++) logError(new Error(`e${i}`));
    const log = getErrorLog();
    expect(log).toHaveLength(100);
    expect(log[0]?.message).toBe('e5');
    expect(log[99]?.message).toBe('e104');
  });

  it('survives corrupted storage', () => {
    localStorage.setItem('ascend.errorLog', '{not json');
    expect(getErrorLog()).toEqual([]);
    logError(new Error('after corruption'));
    expect(getErrorLog()).toHaveLength(1);
  });

  it('formats newest first', () => {
    logError(new Error('first'));
    logError(new Error('second'));
    const text = formatErrorLog();
    expect(text.indexOf('second')).toBeLessThan(text.indexOf('first'));
  });

  it('never stores tokens, keys, sign-in codes or emails (hardening V-15)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.c2lnbmF0dXJlLXZhbHVl';
    const err = new Error(
      `sync failed for rishi.test+x@example.co.in: Bearer ${jwt} at https://app/settings?code=abc123&next=1`,
    );
    err.stack = `Error: boom
 at fetch (https://x.supabase.co/auth?access_token=${jwt}&type=magiclink)`;
    logError(err, 'auth with sb_publishable_abcDEF123 and sk-or-v1-deadbeef');
    const saved = JSON.stringify(getErrorLog());
    for (const secret of [
      jwt,
      'abc123',
      'rishi.test+x@example.co.in',
      'sb_publishable_abcDEF123',
      'sk-or-v1-deadbeef',
    ]) {
      expect(saved).not.toContain(secret);
    }
    expect(saved).toContain('[email]');
    expect(saved).toContain('Bearer [token]');
    expect(saved).toContain('code=[redacted]');
    expect(saved).toContain('&next=1'); // the rest of the message stays useful
  });

  it('leaves ordinary messages alone', () => {
    const text = 'QuotaExceededError: the database is full (2026-11-11, habit h-1, v0.12.0)';
    expect(scrubSecrets(text)).toBe(text);
  });
});
