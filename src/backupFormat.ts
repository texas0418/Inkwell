// src/backupFormat.ts
// Pure module (Node-testable): versioned JSON backup format.
// Version 1: every entry with its photos embedded as base64 — one file IS the
// whole journal, matching the privacy promise (no server-side copies exist).
// Forward rule: parse must tolerate missing fields by defaulting, never throw
// on well-formed older backups.

import type { Mood } from './models';
import { DAY_KEY_RE, MOOD_KEYS } from './models';

export const BACKUP_FORMAT = 'inkwell-backup';
export const BACKUP_VERSION = 1;

export interface BackupPhotoV1 {
  base64: string;
  ext: string; // 'jpg' | 'png' | ...
  position: number;
  width: number;
  height: number;
}

export interface BackupEntryV1 {
  dayKey: string;
  createdAtMs: number;
  updatedAtMs: number;
  title: string;
  body: string;
  mood: Mood | null;
  pinned: boolean; // added post-v1; parse defaults to false, so still version 1
  photos: BackupPhotoV1[];
}

export interface BackupV1 {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAtMs: number;
  entries: BackupEntryV1[];
}

export function serializeBackup(entries: BackupEntryV1[], nowMs: number): string {
  const b: BackupV1 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAtMs: nowMs,
    entries,
  };
  return JSON.stringify(b);
}

const EXT_RE = /^[a-z0-9]{1,5}$/;

/** Returns a validated backup or throws Error with a human-readable reason. */
export function parseBackup(json: string): BackupV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Not a valid backup file (not JSON).');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Not a valid backup file.');
  }
  const o = raw as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT) {
    throw new Error('Not an Inkwell backup file.');
  }
  if (typeof o.version !== 'number' || o.version > BACKUP_VERSION) {
    throw new Error('Backup was made by a newer version of Inkwell.');
  }
  if (!Array.isArray(o.entries)) {
    throw new Error('Backup contains no entry list.');
  }

  const entries: BackupEntryV1[] = [];
  for (const rawEntry of o.entries) {
    if (typeof rawEntry !== 'object' || rawEntry === null) continue;
    const e = rawEntry as Record<string, unknown>;
    if (typeof e.dayKey !== 'string' || !DAY_KEY_RE.test(e.dayKey)) continue;
    if (typeof e.createdAtMs !== 'number') continue;

    const photos: BackupPhotoV1[] = [];
    if (Array.isArray(e.photos)) {
      for (const rawPhoto of e.photos) {
        if (typeof rawPhoto !== 'object' || rawPhoto === null) continue;
        const p = rawPhoto as Record<string, unknown>;
        if (typeof p.base64 !== 'string' || p.base64.length === 0) continue;
        photos.push({
          base64: p.base64,
          ext: typeof p.ext === 'string' && EXT_RE.test(p.ext) ? p.ext : 'jpg',
          position: typeof p.position === 'number' ? p.position : photos.length,
          width: typeof p.width === 'number' ? p.width : 0,
          height: typeof p.height === 'number' ? p.height : 0,
        });
      }
    }

    entries.push({
      dayKey: e.dayKey,
      createdAtMs: e.createdAtMs,
      updatedAtMs: typeof e.updatedAtMs === 'number' ? e.updatedAtMs : e.createdAtMs,
      title: typeof e.title === 'string' ? e.title : '',
      body: typeof e.body === 'string' ? e.body : '',
      mood: MOOD_KEYS.has(e.mood as string) ? (e.mood as Mood) : null,
      pinned: e.pinned === true,
      photos,
    });
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAtMs: typeof o.exportedAtMs === 'number' ? o.exportedAtMs : 0,
    entries,
  };
}
