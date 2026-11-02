import { applyTheme, resolveTheme } from './theme';

function mockSystemDark(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) => listeners.delete(fn),
  };
  window.matchMedia = vi.fn().mockReturnValue(media);
  return {
    set(value: boolean) {
      media.matches = value;
      listeners.forEach((fn) => fn());
    },
    listenerCount: () => listeners.size,
  };
}

describe('resolveTheme', () => {
  it('follows the system for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('uses an explicit choice regardless of the system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('sets data-theme and follows live system changes for "system"', () => {
    const system = mockSystemDark(false);
    const stop = applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('light');
    system.set(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    stop();
    expect(system.listenerCount()).toBe(0);
  });

  it('ignores system changes for an explicit choice', () => {
    const system = mockSystemDark(true);
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(system.listenerCount()).toBe(0);
  });
});
