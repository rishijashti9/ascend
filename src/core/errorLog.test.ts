import { clearErrorLog, formatErrorLog, getErrorLog, logError } from './errorLog';

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
});
