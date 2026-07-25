// src/pdf.ts
// "Print your year": typeset the whole journal as a PDF via expo-print and
// hand it to the share sheet. Photos are embedded as base64 (the PDF is
// self-contained, like the JSON backup). Pro feature; the JSON backup of raw
// data stays free forever per house rule.

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getAllEntriesWithPhotos } from './db';
import { dateFromDayKey, moodEmoji } from './models';
import { readPhotoBase64 } from './photos';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const extToMime = (name: string): string => {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
};

export async function exportJournalPdf(): Promise<void> {
  const items = getAllEntriesWithPhotos();
  if (!items.length) throw new Error('Nothing to export yet — write an entry first.');

  const sections: string[] = [];
  for (const { entry, photos } of items) {
    const d = dateFromDayKey(entry.dayKey);
    const dateLabel = d.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const imgs: string[] = [];
    for (const p of photos) {
      const b64 = await readPhotoBase64(p.fileName);
      if (b64) {
        imgs.push(
          `<img src="data:${extToMime(p.fileName)};base64,${b64}" alt="" />`,
        );
      }
    }
    sections.push(`
      <section>
        <div class="date">${esc(dateLabel)}${entry.pinned ? ' <span class="star">★</span>' : ''}</div>
        ${entry.title ? `<h2>${moodEmoji(entry.mood)} ${esc(entry.title)}</h2>` : ''}
        ${entry.body ? `<p>${esc(entry.body).replace(/\n/g, '<br/>')}</p>` : ''}
        ${imgs.length ? `<div class="photos">${imgs.join('')}</div>` : ''}
      </section>`);
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 48px; }
    body { font-family: Georgia, serif; color: #2b2721; }
    h1 { font-weight: normal; font-size: 28px; margin: 0 0 2px; }
    .sub { color: #948c79; font-size: 12px; margin-bottom: 28px; }
    section { margin-bottom: 26px; page-break-inside: avoid; }
    .date { font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
            color: #948c79; margin-bottom: 4px; }
    .star { color: #9a7a2f; }
    h2 { font-size: 17px; font-weight: normal; margin: 0 0 6px; }
    p { font-size: 12.5px; line-height: 1.55; margin: 0; white-space: normal; }
    .photos { margin-top: 8px; }
    .photos img { max-width: 45%; max-height: 220px; margin: 0 8px 8px 0;
                  border-radius: 6px; }
  </style></head><body>
    <h1>Inkwell</h1>
    <div class="sub">${items.length} entries · exported ${new Date().toLocaleDateString()}</div>
    ${sections.join('\n')}
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Export journal as PDF',
  });
}
