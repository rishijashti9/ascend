/**
 * Themes (Phase 12, SPEC 6.9). A theme = its colour/shape/type tokens (src/styles/themes/<id>.css,
 * selected by data-theme on <html>) + this definition: how its surfaces behave, its motion and
 * effects, its fonts, and the palette the Android widgets and the picker preview use. Screens
 * read tokens and these switches only — adding a theme is a new CSS file + a new entry here.
 *
 * A theme is listed (and can be chosen) only once it is fully built (`built: true`).
 */
export type ThemeId = 'elevate' | 'void' | 'solar' | 'ion';

/** How panels and tiles look: bento tiles, glass, neo-brutal blocks, or soft neumorphic. */
export type SurfaceStyle = 'tile' | 'glass' | 'brutal' | 'soft';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  /** One line for the picker. */
  tagline: string;
  scheme: 'dark' | 'light';
  surface: SurfaceStyle;
  /** Motion character used by the VFX layer. */
  motion: 'smooth' | 'glow' | 'snap' | 'calm';
  /** Fully built and selectable. */
  built: boolean;
  /** Loads this theme's fonts (bundled; only fetched when the theme is used). */
  loadFonts: () => Promise<unknown>;
  /** Colours for the picker preview and the Android widgets (no CSS available there). */
  palette: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    onAccent: string;
    tiles: [string, string, string, string];
  };
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  elevate: {
    id: 'elevate',
    name: 'Elevate',
    tagline: 'Black ground, bright bento tiles, bold type.',
    scheme: 'dark',
    surface: 'tile',
    motion: 'smooth',
    built: true,
    // Archivo is bundled with the main stylesheet (ELEVATE is the default theme).
    loadFonts: () => Promise.resolve(),
    palette: {
      bg: '#000000',
      surface: '#161616',
      text: '#F2F2F2',
      muted: '#9A9A9A',
      accent: '#C8F03C',
      onAccent: '#000000',
      tiles: ['#C8F03C', '#F2F2F2', '#FFE14D', '#A35BFF'],
    },
  },
  void: {
    id: 'void',
    name: 'Void',
    tagline: 'Dark glass and neon glow.',
    scheme: 'dark',
    surface: 'glass',
    motion: 'glow',
    built: false,
    loadFonts: () => Promise.resolve(),
    palette: {
      bg: '#0B0F14',
      surface: '#121822',
      text: '#E6F1FF',
      muted: '#8EA0B5',
      accent: '#3DF2E0',
      onAccent: '#0B0F14',
      tiles: ['#3DF2E0', '#8A6CFF', '#E445FF', '#1B2433'],
    },
  },
  solar: {
    id: 'solar',
    name: 'Solar',
    tagline: 'Bold blocks, thick outlines, hard shadows.',
    scheme: 'light',
    surface: 'brutal',
    motion: 'snap',
    built: false,
    loadFonts: () => Promise.resolve(),
    palette: {
      bg: '#F4F1E8',
      surface: '#FFFFFF',
      text: '#0C1A2B',
      muted: '#3B4A5C',
      accent: '#B6FF3B',
      onAccent: '#0C1A2B',
      tiles: ['#B6FF3B', '#FFD93D', '#FF7A45', '#C9BCFF'],
    },
  },
  ion: {
    id: 'ion',
    name: 'Ion',
    tagline: 'Soft, calm and light.',
    scheme: 'light',
    surface: 'soft',
    motion: 'calm',
    built: false,
    loadFonts: () => Promise.resolve(),
    palette: {
      bg: '#E4E9F0',
      surface: '#E4E9F0',
      text: '#1F2A37',
      muted: '#4B5867',
      accent: '#4FC3F7',
      onAccent: '#0B2540',
      tiles: ['#4FC3F7', '#E445FF', '#FF8A3D', '#FFFFFF'],
    },
  },
};

export const DEFAULT_THEME: ThemeId = 'elevate';

/** Themes that can be chosen now (fully built), in picker order. */
export function builtThemes(): ThemeDef[] {
  return (Object.values(THEMES) as ThemeDef[]).filter((t) => t.built);
}

/** The theme to show for a stored choice: unknown or not-yet-built themes fall back. */
export function resolveThemeId(stored: string | null | undefined): ThemeId {
  const t = stored ? THEMES[stored as ThemeId] : undefined;
  return t?.built ? t.id : DEFAULT_THEME;
}
