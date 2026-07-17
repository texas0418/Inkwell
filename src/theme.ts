// src/theme.ts — Inkwell palette. Warm paper + ink, light-first (a journal
// should feel like a nice notebook, not a terminal). Serif for entry titles.

import { Platform } from 'react-native';

export const colors = {
  bg: '#f6f1e7', // paper
  card: '#fffdf8',
  cardBorder: '#e7dfcd',
  hairline: '#eae2d1',
  textPrimary: '#2b2721', // ink
  textBody: '#4c463b',
  textMuted: '#948c79',
  // accent — fountain-pen blue
  ink: '#33567f',
  inkSoft: '#dfe7f0',
  inkBorder: '#b9c9db',
  // moods
  moodGreat: '#5f8f54',
  moodGood: '#87a45e',
  moodOk: '#c4a04a',
  moodLow: '#c07f45',
  moodRough: '#a85a4b',
  // misc
  danger: '#b0472e',
  proGold: '#9a7a2f',
} as const;

/** Serif for titles/branding — notebook feel. Body stays system sans. */
export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });

export const moodColor: Record<string, string> = {
  great: colors.moodGreat,
  good: colors.moodGood,
  ok: colors.moodOk,
  low: colors.moodLow,
  rough: colors.moodRough,
};
