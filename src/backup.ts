// src/backup.ts
// Native side of backup. Export: gather entries + photo files (base64), write
// JSON to cache, open share sheet. Import: document picker -> parseBackup ->
// caller confirms -> applyBackup replaces everything (rows AND photo files).
// Legacy file-system imports per house convention.

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { EntryPhoto, EntryWithPhotos } from './models';
import { getAllEntriesWithPhotos, replaceAllEntries } from './db';
import {
  BackupEntryV1,
  BackupV1,
  parseBackup,
  serializeBackup,
} from './backupFormat';
import { clearAllPhotoFiles, readPhotoBase64, writePhotoBase64 } from './photos';

const fileName = (nowMs: number): string => {
  const d = new Date(nowMs);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `inkwell-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
};

const extOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'jpg';
};

/** Writes the backup (photos embedded) and opens the share sheet. Throws on failure. */
export async function exportBackup(): Promise<void> {
  const now = Date.now();
  const items = getAllEntriesWithPhotos();

  const entries: BackupEntryV1[] = [];
  for (const { entry, photos } of items) {
    const backupPhotos = [];
    for (const p of photos) {
      const base64 = await readPhotoBase64(p.fileName);
      if (!base64) continue; // file went missing; keep the text, skip the photo
      backupPhotos.push({
        base64,
        ext: extOf(p.fileName),
        position: p.position,
        width: p.width,
        height: p.height,
      });
    }
    entries.push({
      dayKey: entry.dayKey,
      createdAtMs: entry.createdAtMs,
      updatedAtMs: entry.updatedAtMs,
      title: entry.title,
      body: entry.body,
      mood: entry.mood,
      pinned: entry.pinned,
      photos: backupPhotos,
    });
  }

  const uri = `${FileSystem.cacheDirectory}${fileName(now)}`;
  await FileSystem.writeAsStringAsync(uri, serializeBackup(entries, now));
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export Inkwell backup',
  });
}

/** Picks a backup file and parses it. Returns null if the user cancelled.
 *  Throws with a readable message if the file is invalid. */
export async function pickBackup(): Promise<BackupV1 | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const json = await FileSystem.readAsStringAsync(res.assets[0].uri);
  return parseBackup(json);
}

/** Replace-all restore: wipes current rows and photo files, then writes the
 *  backup's photos to disk and inserts everything. Caller confirms first. */
export async function applyBackup(b: BackupV1): Promise<void> {
  await clearAllPhotoFiles();
  const items: EntryWithPhotos[] = [];
  for (const e of b.entries) {
    const photos: EntryPhoto[] = [];
    for (const p of e.photos) {
      const name = await writePhotoBase64(p.base64, p.ext);
      photos.push({
        fileName: name,
        position: p.position,
        width: p.width,
        height: p.height,
      });
    }
    items.push({
      entry: {
        dayKey: e.dayKey,
        createdAtMs: e.createdAtMs,
        updatedAtMs: e.updatedAtMs,
        title: e.title,
        body: e.body,
        mood: e.mood,
        pinned: e.pinned,
      },
      photos,
    });
  }
  replaceAllEntries(items);
}
