import { describe, expect, it } from 'vitest';
import { notesFor, shouldPlay } from './feedback';

describe('sound + haptics', () => {
  it('stays silent unless switched on, and while hidden', () => {
    expect(shouldPlay(undefined, false)).toBe(false); // off by default
    expect(shouldPlay(false, false)).toBe(false);
    expect(shouldPlay(true, true)).toBe(false);
    expect(shouldPlay(true, false)).toBe(true);
  });

  it('keeps every sound short and rising', () => {
    for (const kind of ['complete', 'levelup', 'rankup'] as const) {
      const notes = notesFor(kind);
      const end = Math.max(...notes.map((n) => n.at + n.len));
      expect(end).toBeLessThan(1.1);
      const hz = notes.map((n) => n.hz);
      expect(hz).toEqual([...hz].sort((a, b) => a - b));
    }
    expect(notesFor('rankup').length).toBeGreaterThan(notesFor('levelup').length);
  });
});
