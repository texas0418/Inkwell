// src/theme.ts — Inkwell theming: journal color palettes × day/night × font.
// DayPorter house pattern: settings pick mode/palette/font, useTheme() resolves,
// screens build StyleSheets from the palette via makeStyles(c) + useMemo so
// nothing hardcodes a mode. Light stays "paper", dark stays "last page by
// lamplight" — never terminal-black.

import { Platform, useColorScheme } from 'react-native';
import type { FontChoice, PaletteId } from './SettingsContext';
import { useSettings } from './SettingsContext';

export type ThemeScheme = 'light' | 'dark';

export interface Palette {
  bg: string; // paper
  card: string;
  cardBorder: string;
  hairline: string;
  textPrimary: string; // ink
  textBody: string;
  textMuted: string;
  accent: string; // pen ink: buttons, links, dots, selection
  accentSoft: string; // selected-chip fill
  accentBorder: string;
  accentText: string; // text on accent fills
  danger: string;
  proGold: string;
}

interface JournalPalette {
  label: string;
  swatch: string; // picker chip color (the light-mode accent)
  light: Palette;
  dark: Palette;
}

const shared = { proGold: '#9a7a2f' };
const sharedDark = { proGold: '#c8a54e' };

export const PALETTES: Record<PaletteId, JournalPalette> = {
  ink: {
    label: 'Ink',
    swatch: '#33567f',
    light: {
      bg: '#f6f1e7', card: '#fffdf8', cardBorder: '#e7dfcd', hairline: '#eae2d1',
      textPrimary: '#2b2721', textBody: '#4c463b', textMuted: '#948c79',
      accent: '#33567f', accentSoft: '#dfe7f0', accentBorder: '#b9c9db',
      accentText: '#ffffff', danger: '#b0472e', ...shared,
    },
    dark: {
      bg: '#191c22', card: '#22262e', cardBorder: '#343a45', hairline: '#2b3039',
      textPrimary: '#ecebe6', textBody: '#c8c7bf', textMuted: '#8b8b83',
      accent: '#8fb0d6', accentSoft: '#263243', accentBorder: '#415670',
      accentText: '#12161c', danger: '#dd7a5f', ...sharedDark,
    },
  },
  forest: {
    label: 'Forest',
    swatch: '#3f6f4e',
    light: {
      bg: '#f3f2e9', card: '#fcfcf5', cardBorder: '#dfe0cd', hairline: '#e5e6d4',
      textPrimary: '#26291f', textBody: '#454a3a', textMuted: '#8c9079',
      accent: '#3f6f4e', accentSoft: '#e0ebe0', accentBorder: '#b7cdb9',
      accentText: '#ffffff', danger: '#b0472e', ...shared,
    },
    dark: {
      bg: '#181d18', card: '#212721', cardBorder: '#333c33', hairline: '#2a322a',
      textPrimary: '#e9ece6', textBody: '#c4cabf', textMuted: '#879183',
      accent: '#8ec49b', accentSoft: '#263a2b', accentBorder: '#3f5c45',
      accentText: '#101510', danger: '#dd7a5f', ...sharedDark,
    },
  },
  plum: {
    label: 'Plum',
    swatch: '#6d4a72',
    light: {
      bg: '#f6f0ef', card: '#fdf9f8', cardBorder: '#e6dade', hairline: '#ece0e3',
      textPrimary: '#2c2429', textBody: '#4d4149', textMuted: '#97878f',
      accent: '#6d4a72', accentSoft: '#ece0ee', accentBorder: '#cdb3d1',
      accentText: '#ffffff', danger: '#b0472e', ...shared,
    },
    dark: {
      bg: '#1d181e', card: '#272128', cardBorder: '#3b333d', hairline: '#312a33',
      textPrimary: '#ece7ec', textBody: '#cbc2cb', textMuted: '#93878f',
      accent: '#c49fca', accentSoft: '#382c3b', accentBorder: '#584a5c',
      accentText: '#160f17', danger: '#dd7a5f', ...sharedDark,
    },
  },
  sepia: {
    label: 'Sepia',
    swatch: '#8a5a2b',
    light: {
      bg: '#f7efe2', card: '#fdf8ee', cardBorder: '#e8dcc4', hairline: '#ede1cb',
      textPrimary: '#33291c', textBody: '#544733', textMuted: '#9c8d74',
      accent: '#8a5a2b', accentSoft: '#f0e2cd', accentBorder: '#d6bb93',
      accentText: '#ffffff', danger: '#a63d33', ...shared,
    },
    dark: {
      bg: '#1e1a14', card: '#28231b', cardBorder: '#3d362a', hairline: '#332d22',
      textPrimary: '#ede8de', textBody: '#cdc4b4', textMuted: '#958a76',
      accent: '#d0a25e', accentSoft: '#3a2f1e', accentBorder: '#5d4c30',
      accentText: '#171208', danger: '#dd7a5f', ...sharedDark,
    },
  },
  slate: {
    label: 'Slate',
    swatch: '#4a5866',
    light: {
      bg: '#f0f1f2', card: '#fafbfc', cardBorder: '#dde0e4', hairline: '#e4e7ea',
      textPrimary: '#22262b', textBody: '#42474e', textMuted: '#8b9199',
      accent: '#4a5866', accentSoft: '#e2e7ec', accentBorder: '#bcc6d0',
      accentText: '#ffffff', danger: '#b0472e', ...shared,
    },
    dark: {
      bg: '#16181b', card: '#1f2226', cardBorder: '#323740', hairline: '#282c32',
      textPrimary: '#e8eaed', textBody: '#c3c8ce', textMuted: '#868d96',
      accent: '#9db2c7', accentSoft: '#2a323c', accentBorder: '#48586a',
      accentText: '#0f1215', danger: '#dd7a5f', ...sharedDark,
    },
  },
};

export const PALETTE_IDS: PaletteId[] = ['ink', 'forest', 'plum', 'sepia', 'slate'];

// Moods stay semantic across palettes; lifted variants for dark grounds.
const moodLight: Record<string, string> = {
  great: '#5f8f54', good: '#87a45e', ok: '#c4a04a', low: '#c07f45', rough: '#a85a4b',
};
const moodDark: Record<string, string> = {
  great: '#84b877', good: '#a9c47e', ok: '#d9b968', low: '#d69a62', rough: '#c97f70',
};

export interface ThemeFonts {
  /** Entry titles, wordmark, section headings. undefined = system default. */
  title: string | undefined;
  /** Entry body text in the editor and previews. */
  body: string | undefined;
}

const FONT_FAMILIES: Record<FontChoice, ThemeFonts> = {
  serif: {
    title: Platform.select({ ios: 'Georgia', default: 'serif' }),
    body: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  sans: { title: undefined, body: undefined },
  mono: {
    title: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    body: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
};

export const FONT_CHOICES: { key: FontChoice; label: string }[] = [
  { key: 'serif', label: 'Serif' },
  { key: 'sans', label: 'Sans' },
  { key: 'mono', label: 'Typewriter' },
];

export interface Theme {
  scheme: ThemeScheme;
  colors: Palette;
  fonts: ThemeFonts;
  mood: (m: string | null) => string;
  /** For expo StatusBar: the text color, i.e. the opposite of the scheme. */
  statusBarStyle: 'light' | 'dark';
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const { settings } = useSettings();
  const scheme: ThemeScheme =
    settings.themeMode === 'system'
      ? system === 'dark'
        ? 'dark'
        : 'light'
      : settings.themeMode;
  const pal = PALETTES[settings.paletteId] ?? PALETTES.ink;
  const moods = scheme === 'dark' ? moodDark : moodLight;
  return {
    scheme,
    colors: scheme === 'dark' ? pal.dark : pal.light,
    fonts: FONT_FAMILIES[settings.font] ?? FONT_FAMILIES.serif,
    mood: (m) => (m && moods[m]) || (scheme === 'dark' ? '#8b8b83' : '#948c79'),
    statusBarStyle: scheme === 'dark' ? 'light' : 'dark',
  };
}
