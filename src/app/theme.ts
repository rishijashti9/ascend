import { resolveThemeId, THEMES, type ThemeId } from '@/config/themes';
import { logError } from '@/core/errorLog';

/**
 * The old light / dark / system preference (Phases 1–11). Phase 12 replaced it with themes
 * (`settings.ui_theme`); stored records keep the field, it is simply no longer used.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Shows a theme: sets data-theme on <html> (which switches the token set), the browser /
 * Android status-bar colour, and loads the theme's fonts. Unknown or unbuilt themes fall back to
 * the default. Returns the theme actually shown.
 */
export function applyUiTheme(stored: string | null | undefined): ThemeId {
  const id = resolveThemeId(stored);
  const def = THEMES[id];
  const root = document.documentElement;
  root.dataset.theme = id;
  root.style.colorScheme = def.scheme;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = def.palette.bg;
  def.loadFonts().catch((error: unknown) => logError(error, `theme.fonts:${id}`));
  return id;
}
