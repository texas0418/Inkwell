// src/db.ts
// expo-sqlite wrapper. All SQL and mapping live in dbCore.ts (pure, tested).
// House pattern: lazy singleton, PRAGMA user_version migrations in a
// transaction, integer epoch-ms everywhere. FKs on so photos cascade.

import * as SQLite from 'expo-sqlite';
import type { EntryPhoto, EntryWithPhotos, JournalEntry } from './models';
import {
  ALL_DAY_KEYS_SQL,
  ALL_ENTRIES_SQL,
  ALL_PHOTOS_SQL,
  COUNT_ENTRIES_SQL,
  DAY_COUNTS_FOR_MONTH_SQL,
  DELETE_ALL_ENTRIES_SQL,
  DELETE_ALL_PHOTOS_SQL,
  DELETE_ENTRY_SQL,
  DELETE_PHOTO_SQL,
  EntryRow,
  GET_ENTRY_SQL,
  INSERT_ENTRY_SQL,
  INSERT_PHOTO_SQL,
  LIST_ENTRIES_FOR_DAY_SQL,
  LIST_PHOTOS_FOR_ENTRY_SQL,
  LIST_PINNED_SQL,
  LIST_RECENT_ENTRIES_SQL,
  MIGRATIONS,
  ON_THIS_DAY_SQL,
  PhotoRow,
  SEARCH_ENTRIES_SQL,
  UPDATE_ENTRY_SQL,
  entryToParams,
  likePattern,
  photoToParams,
  rowToEntry,
  rowToPhoto,
} from './dbCore';

const DB_NAME = 'inkwell.db';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    db.execSync('PRAGMA journal_mode = WAL');
    db.execSync('PRAGMA foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(d: SQLite.SQLiteDatabase): void {
  const row = d.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const batch = MIGRATIONS[version];
    d.withTransactionSync(() => {
      for (const sql of batch) d.execSync(sql);
    });
    version++;
    d.execSync(`PRAGMA user_version = ${version}`);
  }
}

// ----------------------------------------------------------------- entries

export function insertEntry(e: JournalEntry): number {
  const res = getDb().runSync(INSERT_ENTRY_SQL, entryToParams(e));
  return Number(res.lastInsertRowId);
}

export function updateEntry(e: JournalEntry): void {
  if (e.id == null) throw new Error('updateEntry requires id');
  getDb().runSync(UPDATE_ENTRY_SQL, [...entryToParams(e), e.id]);
}

/** Deletes the entry; photo ROWS cascade. Files are the caller's job
 *  (delete via photos.deletePhotoFile after listing them first). */
export function deleteEntry(id: number): void {
  getDb().runSync(DELETE_ENTRY_SQL, [id]);
}

export function getEntry(id: number): JournalEntry | null {
  const row = getDb().getFirstSync<EntryRow>(GET_ENTRY_SQL, [id]);
  return row ? rowToEntry(row) : null;
}

export function listRecentEntries(limit: number): JournalEntry[] {
  return getDb().getAllSync<EntryRow>(LIST_RECENT_ENTRIES_SQL, [limit]).map(rowToEntry);
}

export function listEntriesForDay(dayKey: string): JournalEntry[] {
  return getDb().getAllSync<EntryRow>(LIST_ENTRIES_FOR_DAY_SQL, [dayKey]).map(rowToEntry);
}

export function searchEntries(query: string, limit: number): JournalEntry[] {
  const p = likePattern(query);
  return getDb().getAllSync<EntryRow>(SEARCH_ENTRIES_SQL, [p, p, limit]).map(rowToEntry);
}

/** dayKey -> entry count for one month ('YYYY-MM' prefix). */
export function dayCountsForMonth(prefix: string): Record<string, number> {
  const rows = getDb().getAllSync<{ day_key: string; count: number }>(
    DAY_COUNTS_FOR_MONTH_SQL,
    [`${prefix}%`],
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.day_key] = r.count;
  return out;
}

export function countEntries(): number {
  const row = getDb().getFirstSync<{ count: number }>(COUNT_ENTRIES_SQL);
  return row?.count ?? 0;
}

export function listPinnedEntries(): JournalEntry[] {
  return getDb().getAllSync<EntryRow>(LIST_PINNED_SQL).map(rowToEntry);
}

/** Entries from the same month-day in earlier years. */
export function listOnThisDay(todayKey: string): JournalEntry[] {
  const mmdd = todayKey.slice(5);
  return getDb().getAllSync<EntryRow>(ON_THIS_DAY_SQL, [mmdd, todayKey]).map(rowToEntry);
}

/** Distinct written days, newest first (streak input). */
export function getAllDayKeys(): string[] {
  return getDb()
    .getAllSync<{ day_key: string }>(ALL_DAY_KEYS_SQL)
    .map((r) => r.day_key);
}

export function getAllEntries(): JournalEntry[] {
  return getDb().getAllSync<EntryRow>(ALL_ENTRIES_SQL).map(rowToEntry);
}

// ------------------------------------------------------------------ photos

export function insertPhoto(entryId: number, p: EntryPhoto): number {
  const res = getDb().runSync(INSERT_PHOTO_SQL, photoToParams(entryId, p));
  return Number(res.lastInsertRowId);
}

export function deletePhoto(id: number): void {
  getDb().runSync(DELETE_PHOTO_SQL, [id]);
}

export function listPhotosForEntry(entryId: number): EntryPhoto[] {
  return getDb()
    .getAllSync<PhotoRow>(LIST_PHOTOS_FOR_ENTRY_SQL, [entryId])
    .map(rowToPhoto);
}

/** entryId -> cover photo (lowest position), for list thumbnails. */
export function getCoverPhotos(): Map<number, EntryPhoto> {
  const out = new Map<number, EntryPhoto>();
  for (const r of getDb().getAllSync<PhotoRow>(ALL_PHOTOS_SQL)) {
    if (!out.has(r.entry_id)) out.set(r.entry_id, rowToPhoto(r));
  }
  return out;
}

export function getAllPhotos(): EntryPhoto[] {
  return getDb().getAllSync<PhotoRow>(ALL_PHOTOS_SQL).map(rowToPhoto);
}

// ------------------------------------------------------------------ backup

export function getAllEntriesWithPhotos(): EntryWithPhotos[] {
  const entries = getDb().getAllSync<EntryRow>(ALL_ENTRIES_SQL).map(rowToEntry);
  const photosByEntry = new Map<number, EntryPhoto[]>();
  for (const r of getDb().getAllSync<PhotoRow>(ALL_PHOTOS_SQL)) {
    const list = photosByEntry.get(r.entry_id) ?? [];
    list.push(rowToPhoto(r));
    photosByEntry.set(r.entry_id, list);
  }
  return entries.map((entry) => ({
    entry,
    photos: entry.id != null ? (photosByEntry.get(entry.id) ?? []) : [],
  }));
}

/** Restore: replace-all inside one transaction (house backup semantics).
 *  Photo FILES must already exist; rows here just reference their fileNames. */
export function replaceAllEntries(items: EntryWithPhotos[]): void {
  const d = getDb();
  d.withTransactionSync(() => {
    d.execSync(DELETE_ALL_PHOTOS_SQL);
    d.execSync(DELETE_ALL_ENTRIES_SQL);
    for (const { entry, photos } of items) {
      const res = d.runSync(INSERT_ENTRY_SQL, entryToParams(entry));
      const entryId = Number(res.lastInsertRowId);
      for (const p of photos) d.runSync(INSERT_PHOTO_SQL, photoToParams(entryId, p));
    }
  });
}

export function deleteAllData(): void {
  const d = getDb();
  d.withTransactionSync(() => {
    d.execSync(DELETE_ALL_PHOTOS_SQL);
    d.execSync(DELETE_ALL_ENTRIES_SQL);
  });
}
