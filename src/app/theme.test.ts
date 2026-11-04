import { builtThemes, DEFAULT_THEME, resolveThemeId, THEMES } from '@/config/themes';
import { applyUiTheme } from './theme';

describe('themes', () => {
  it('ELEVATE is the default and the only built theme in 12A', () => {
    expect(DEFAULT_THEME).toBe('elevate');
    expect(builtThemes().map((t) => t.id)).toEqual(['elevate']);
  });

  it('unknown, missing or not-yet-built themes fall back to the default', () => {
    expect(resolveThemeId(undefined)).toBe('elevate');
    expect(resolveThemeId('dark')).toBe('elevate');
    expect(resolveThemeId('void')).toBe(THEMES.void.built ? 'void' : 'elevate');
    expect(resolveThemeId('elevate')).toBe('elevate');
  });

  it('applying a theme sets data-theme, the colour scheme and the status-bar colour', () => {
    expect(applyUiTheme('elevate')).toBe('elevate');
    expect(document.documentElement.dataset.theme).toBe('elevate');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      '#000000',
    );
  });
});
