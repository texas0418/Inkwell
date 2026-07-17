// src/photos.ts
// Photo files live in <documentDirectory>/photos/. The database stores only
// file names; this module owns the directory. Legacy file-system imports per
// house convention.

import * as FileSystem from 'expo-file-system/legacy';

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos/`;

let counter = 0;

function freshName(ext: string): string {
  counter++;
  return `p${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}.${ext}`;
}

function extFromUri(uri: string): string {
  const m = /\.(jpe?g|png|gif|webp|heic)$/i.exec(uri.split('?')[0]);
  const ext = m ? m[1].toLowerCase() : 'jpg';
  return ext === 'jpeg' ? 'jpg' : ext;
}

export async function ensurePhotosDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export function photoUri(fileName: string): string {
  return `${PHOTOS_DIR}${fileName}`;
}

/** Copies a picked image into the photos dir. Returns the stored fileName. */
export async function importPhotoFile(srcUri: string): Promise<string> {
  await ensurePhotosDir();
  const fileName = freshName(extFromUri(srcUri));
  await FileSystem.copyAsync({ from: srcUri, to: photoUri(fileName) });
  return fileName;
}

export async function deletePhotoFile(fileName: string): Promise<void> {
  await FileSystem.deleteAsync(photoUri(fileName), { idempotent: true });
}

export async function readPhotoBase64(fileName: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(photoUri(fileName));
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(photoUri(fileName), {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/** Writes a restored photo and returns its new fileName. */
export async function writePhotoBase64(base64: string, ext: string): Promise<string> {
  await ensurePhotosDir();
  const fileName = freshName(ext);
  await FileSystem.writeAsStringAsync(photoUri(fileName), base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileName;
}

/** Restore/delete-all support: wipe every stored photo file. */
export async function clearAllPhotoFiles(): Promise<void> {
  await FileSystem.deleteAsync(PHOTOS_DIR, { idempotent: true });
  await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
}
