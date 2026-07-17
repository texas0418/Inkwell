// src/dbCore.ts
// Pure module: SQL schema/migrations and row<->model mapping.
// No expo imports so it can be tested in Node against node:sqlite.

import type { EntryPhoto, JournalEntry, Mood } from './models';
import { MOOD_KEYS } from './models';

/** Each entry is the batch of statements that upgrades user_version N-1 -> N.
 *  MIGRATIONS[0] builds version 1. Append only; never edit shipped entries. */
export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_key TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      mood TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_entries_day ON entries(day_key)`,
    `CREATE INDEX IF NOT EXISTS idx_entries_updated ON entries(updated_at_ms)`,
    `CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_photos_entry ON photos(entry_id)`,
  ],
];

export const TARGET_DB_VERSION = MIGRATIONS.length;

// ----------------------------------------------------------------- entries

export interface EntryRow {
  id: number;
  day_key: string;
  created_at_ms: number;
  updated_at_ms: number;
  title: string;
  body: string;
  mood: string | null;
}

export function rowToEntry(r: EntryRow): JournalEntry {
  return {
    id: r.id,
    dayKey: r.day_key,
    createdAtMs: r.created_at_ms,
    updatedAtMs: r.updated_at_ms,
    title: r.title ?? '',
    body: r.body ?? '',
    mood: MOOD_KEYS.has(r.mood as string) ? (r.mood as Mood) : null,
  };
}

/** Positional params matching INSERT_ENTRY_SQL column order. */
export function entryToParams(
  e: JournalEntry,
): [string, number, number, string, string, string | null] {
  return [e.dayKey, e.createdAtMs, e.updatedAtMs, e.title, e.body, e.mood];
}

export const INSERT_ENTRY_SQL = `INSERT INTO entries
  (day_key, created_at_ms, updated_at_ms, title, body, mood)
  VALUES (?, ?, ?, ?, ?, ?)`;

export const UPDATE_ENTRY_SQL = `UPDATE entries SET
  day_key = ?, updated_at_ms = ?, title = ?, body = ?, mood = ?
  WHERE id = ?`;

export const DELETE_ENTRY_SQL = `DELETE FROM entries WHERE id = ?`;

export const GET_ENTRY_SQL = `SELECT * FROM entries WHERE id = ?`;

export const LIST_RECENT_ENTRIES_SQL = `SELECT * FROM entries
  ORDER BY day_key DESC, created_at_ms DESC LIMIT ?`;

export const LIST_ENTRIES_FOR_DAY_SQL = `SELECT * FROM entries
  WHERE day_key = ? ORDER BY created_at_ms ASC`;

/** LIKE with '\' escape; build patterns with likePattern(). */
export const SEARCH_ENTRIES_SQL = `SELECT * FROM entries
  WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\'
  ORDER BY day_key DESC, created_at_ms DESC LIMIT ?`;

export const DAY_COUNTS_FOR_MONTH_SQL = `SELECT day_key, COUNT(*) AS count
  FROM entries WHERE day_key LIKE ? GROUP BY day_key`;

export const COUNT_ENTRIES_SQL = `SELECT COUNT(*) AS count FROM entries`;

export const ALL_ENTRIES_SQL = `SELECT * FROM entries
  ORDER BY day_key ASC, created_at_ms ASC`;

export const DELETE_ALL_ENTRIES_SQL = `DELETE FROM entries`;

export function likePattern(query: string): string {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

// ------------------------------------------------------------------ photos

export interface PhotoRow {
  id: number;
  entry_id: number;
  file_name: string;
  position: number;
  width: number;
  height: number;
}

export function rowToPhoto(r: PhotoRow): EntryPhoto {
  return {
    id: r.id,
    entryId: r.entry_id,
    fileName: r.file_name,
    position: r.position,
    width: r.width ?? 0,
    height: r.height ?? 0,
  };
}

/** Positional params matching INSERT_PHOTO_SQL column order (entry_id first). */
export function photoToParams(
  entryId: number,
  p: EntryPhoto,
): [number, string, number, number, number] {
  return [entryId, p.fileName, p.position, p.width, p.height];
}

export const INSERT_PHOTO_SQL = `INSERT INTO photos
  (entry_id, file_name, position, width, height)
  VALUES (?, ?, ?, ?, ?)`;

export const DELETE_PHOTO_SQL = `DELETE FROM photos WHERE id = ?`;

export const LIST_PHOTOS_FOR_ENTRY_SQL = `SELECT * FROM photos
  WHERE entry_id = ? ORDER BY position ASC, id ASC`;

/** All photos ordered so the first row per entry is its cover photo. */
export const ALL_PHOTOS_SQL = `SELECT * FROM photos
  ORDER BY entry_id ASC, position ASC, id ASC`;

export const DELETE_ALL_PHOTOS_SQL = `DELETE FROM photos`;
