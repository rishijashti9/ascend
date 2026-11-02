export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Turns the user's preference into the theme to show right now. */
export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

function setDocumentTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Keep the browser/Android status bar colour in step with the background token.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  if (bg) meta.content = bg;
}

/**
 * Applies a theme preference to <html>. For 'system' it follows OS changes live.
 * Returns a function that stops following the OS.
 */
export function applyTheme(pref: ThemePreference): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const update = () => setDocumentTheme(resolveTheme(pref, media.matches));
  update();
  if (pref !== 'system') return () => {};
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}
