// src/models.ts
// Pure module: domain types and date/text helpers. No expo imports.
// Entries belong to a local calendar day identified by a dayKey ('YYYY-MM-DD')
// so a late-night entry stays on the day the user meant, regardless of TZ math.

export type Mood = 'great' | 'good' | 'ok' | 'low' | 'rough';

export const MOODS: { key: Mood; emoji: string; label: string }[] = [
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'ok', emoji: '😐', label: 'Okay' },
  { key: 'low', emoji: '😕', label: 'Low' },
  { key: 'rough', emoji: '😞', label: 'Rough' },
];

export const MOOD_KEYS = new Set<string>(MOODS.map((m) => m.key));

export function moodEmoji(mood: Mood | null): string {
  return MOODS.find((m) => m.key === mood)?.emoji ?? '';
}

export interface JournalEntry {
  id?: number;
  dayKey: string; // 'YYYY-MM-DD', local calendar day
  createdAtMs: number;
  updatedAtMs: number;
  title: string;
  body: string;
  mood: Mood | null;
}

export interface EntryPhoto {
  id?: number;
  entryId?: number;
  fileName: string; // file name inside the app's photos directory
  position: number;
  width: number;
  height: number;
}

export interface EntryWithPhotos {
  entry: JournalEntry;
  photos: EntryPhoto[];
}

// ------------------------------------------------------------------- dates

export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n: number): string => n.toString().padStart(2, '0');

export function dayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayKey(nowMs: number): string {
  return dayKeyFromDate(new Date(nowMs));
}

/** Local midnight of the given dayKey. */
export function dateFromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d);
}

/** 'YYYY-MM' prefix for a month, for LIKE queries and grouping. */
export function monthPrefix(year: number, month0: number): string {
  return `${year}-${pad2(month0 + 1)}`;
}

export function formatDayLabel(key: string, nowMs: number): string {
  const today = todayKey(nowMs);
  if (key === today) return 'Today';
  const yesterday = dayKeyFromDate(new Date(nowMs - 24 * 3600 * 1000));
  if (key === yesterday) return 'Yesterday';
  const d = dateFromDayKey(key);
  const sameYear = d.getFullYear() === new Date(nowMs).getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatMonthLabel(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// -------------------------------------------------------------------- text

/** One-line preview of a body: first non-empty line, ellipsized. */
export function snippet(body: string, max = 120): string {
  const line = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return '';
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
}

/** Display title: explicit title, else first words of the body. */
export function displayTitle(e: JournalEntry): string {
  if (e.title.trim()) return e.title.trim();
  const s = snippet(e.body, 48);
  return s || 'Untitled';
}
