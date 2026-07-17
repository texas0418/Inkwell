// test-db.ts — runs the real schema/SQL from dbCore.ts against node:sqlite.
// Run: npx tsx test-db.ts   (Node 22+; sqlite may need --experimental-sqlite)
// @ts-expect-error node:sqlite has no types under Expo's tsconfig; tsx runs it fine
import { DatabaseSync } from 'node:sqlite';
import type { EntryPhoto, JournalEntry } from './src/models';
import {
  ALL_PHOTOS_SQL, DAY_COUNTS_FOR_MONTH_SQL, DELETE_ENTRY_SQL, EntryRow,
  GET_ENTRY_SQL, INSERT_ENTRY_SQL, INSERT_PHOTO_SQL, LIST_ENTRIES_FOR_DAY_SQL,
  LIST_PHOTOS_FOR_ENTRY_SQL, LIST_RECENT_ENTRIES_SQL, MIGRATIONS, PhotoRow,
  SEARCH_ENTRIES_SQL, TARGET_DB_VERSION, UPDATE_ENTRY_SQL, entryToParams,
  likePattern, photoToParams, rowToEntry, rowToPhoto,
} from './src/dbCore';
import { parseBackup, serializeBackup } from './src/backupFormat';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    failures++;
  } else console.log(`ok   ${name}`);
};

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');

function migrate(): void {
  let v = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  while (v < MIGRATIONS.length) {
    for (const sql of MIGRATIONS[v]) db.exec(sql);
    v++;
    db.exec(`PRAGMA user_version = ${v}`);
  }
}

migrate();
eq('migrates to target version',
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
  TARGET_DB_VERSION);
migrate();
eq('re-migrate is a no-op', true, true);

const T0 = new Date(2026, 6, 12, 9, 0).getTime();
const entry = (partial: Partial<JournalEntry> & Pick<JournalEntry, 'dayKey'>): JournalEntry => ({
  createdAtMs: T0, updatedAtMs: T0, title: '', body: '', mood: null, ...partial,
});

const insert = (e: JournalEntry): number =>
  Number(db.prepare(INSERT_ENTRY_SQL).run(...entryToParams(e)).lastInsertRowid);
const get = (id: number): JournalEntry =>
  rowToEntry(db.prepare(GET_ENTRY_SQL).get(id) as unknown as EntryRow);

// ---- insert / round-trip ----
const id1 = insert(entry({
  dayKey: '2026-07-12', title: 'Beach day', body: 'Sun and 100% sand.\nSecond line.', mood: 'great',
}));
const e1 = get(id1);
eq('entry round-trip', [e1.dayKey, e1.title, e1.body.split('\n')[0], e1.mood],
  ['2026-07-12', 'Beach day', 'Sun and 100% sand.', 'great']);

eq('unknown mood maps to null',
  get(insert(entry({ dayKey: '2026-07-01', mood: 'ecstatic' as any }))).mood, null);

// ---- update ----
db.prepare(UPDATE_ENTRY_SQL).run('2026-07-12', T0 + 1000, 'Beach day!', 'edited', 'good', id1);
eq('update persists', [get(id1).title, get(id1).body, get(id1).mood, get(id1).updatedAtMs],
  ['Beach day!', 'edited', 'good', T0 + 1000]);
eq('update keeps createdAt', get(id1).createdAtMs, T0);

// ---- ordering ----
const id2 = insert(entry({ dayKey: '2026-07-12', createdAtMs: T0 + 5000, title: 'Later same day' }));
const id3 = insert(entry({ dayKey: '2026-06-30', title: 'June' }));
const recent = (db.prepare(LIST_RECENT_ENTRIES_SQL).all(10) as unknown as EntryRow[]).map(rowToEntry);
eq('recent order: newest day first, newest entry first within day',
  recent.map((e) => e.id), [id2, id1, insertOrderFix(), id3]);
function insertOrderFix(): number {
  // the '2026-07-01' unknown-mood entry sits between the 07-12 pair and June
  return recent.find((e) => e.dayKey === '2026-07-01')!.id!;
}

const day = (db.prepare(LIST_ENTRIES_FOR_DAY_SQL).all('2026-07-12') as unknown as EntryRow[]).map(rowToEntry);
eq('day list ascending', day.map((e) => e.id), [id1, id2]);

// ---- search + LIKE escaping ----
const hits = (q: string): number[] => {
  const p = likePattern(q);
  return (db.prepare(SEARCH_ENTRIES_SQL).all(p, p, 50) as unknown as EntryRow[])
    .map((r) => rowToEntry(r).id!) as number[];
};
eq('search matches title', hits('beach'), [id1]);
eq('search matches body', hits('edited'), [id1]);
eq('search escapes %', hits('100%'), []); // '100%' literal no longer in edited body
eq('search finds literal percent', hits('%'), []); // no bare % after edit
insert(entry({ dayKey: '2026-07-13', body: 'made 100% progress_today' }));
eq('escaped % matches literally', hits('100% progress').length, 1);
eq('escaped _ matches literally', hits('progress_today').length, 1);
eq('underscore is not a wildcard', hits('progressXtoday'), []);

// ---- day counts ----
const counts = db.prepare(DAY_COUNTS_FOR_MONTH_SQL).all('2026-07%') as unknown as { day_key: string; count: number }[];
eq('july day counts', counts.sort((a, b) => a.day_key.localeCompare(b.day_key))
  .map((c) => [c.day_key, c.count]),
  [['2026-07-01', 1], ['2026-07-12', 2], ['2026-07-13', 1]]);

// ---- photos + cascade ----
const photo = (fileName: string, position: number): EntryPhoto =>
  ({ fileName, position, width: 100, height: 80 });
db.prepare(INSERT_PHOTO_SQL).run(...photoToParams(id1, photo('a.jpg', 1)));
db.prepare(INSERT_PHOTO_SQL).run(...photoToParams(id1, photo('b.jpg', 0)));
db.prepare(INSERT_PHOTO_SQL).run(...photoToParams(id2, photo('c.jpg', 0)));
const p1 = (db.prepare(LIST_PHOTOS_FOR_ENTRY_SQL).all(id1) as unknown as PhotoRow[]).map(rowToPhoto);
eq('photos ordered by position', p1.map((p) => p.fileName), ['b.jpg', 'a.jpg']);
eq('cover-photo query orders by entry then position',
  (db.prepare(ALL_PHOTOS_SQL).all() as unknown as PhotoRow[])[0].file_name, 'b.jpg');

db.prepare(DELETE_ENTRY_SQL).run(id1);
eq('deleting entry cascades photo rows',
  (db.prepare(LIST_PHOTOS_FOR_ENTRY_SQL).all(id1) as unknown as PhotoRow[]).length, 0);
eq('other entries photos survive',
  (db.prepare(LIST_PHOTOS_FOR_ENTRY_SQL).all(id2) as unknown as PhotoRow[]).length, 1);

// ---- backup format ----
const json = serializeBackup([
  {
    dayKey: '2026-07-12', createdAtMs: T0, updatedAtMs: T0, title: 't', body: 'b',
    mood: 'ok', photos: [{ base64: 'aGVsbG8=', ext: 'jpg', position: 0, width: 1, height: 2 }],
  },
], T0);
const parsed = parseBackup(json);
eq('backup round-trip', [parsed.entries.length, parsed.entries[0].photos[0].base64],
  [1, 'aGVsbG8=']);
eq('backup preserves mood', parsed.entries[0].mood, 'ok');

let threw = '';
try { parseBackup('{"format":"other"}'); } catch (e: any) { threw = e.message; }
eq('foreign file rejected', threw.includes('Inkwell'), true);
try { parseBackup('not json'); } catch (e: any) { threw = e.message; }
eq('garbage rejected', threw.includes('JSON'), true);

const tolerant = parseBackup(JSON.stringify({
  format: 'inkwell-backup', version: 1,
  entries: [
    { dayKey: '2026-01-05', createdAtMs: 5 }, // minimal legal entry
    { dayKey: 'nope', createdAtMs: 5 },       // bad dayKey skipped
    { dayKey: '2026-01-06' },                 // missing createdAtMs skipped
    { dayKey: '2026-01-07', createdAtMs: 7, mood: 'weird', photos: [{ base64: '' }, { base64: 'eA==', ext: '../evil' }] },
  ],
}));
eq('tolerant parse keeps legal entries', tolerant.entries.length, 2);
eq('minimal entry defaults', [tolerant.entries[0].title, tolerant.entries[0].body, tolerant.entries[0].mood, tolerant.entries[0].updatedAtMs],
  ['', '', null, 5]);
eq('bad mood nulled, empty photo skipped, bad ext sanitized',
  [tolerant.entries[1].mood, tolerant.entries[1].photos.length, tolerant.entries[1].photos[0].ext],
  [null, 1, 'jpg']);

console.log(failures ? `\n${failures} FAILURES` : '\nall ok');
process.exit(failures ? 1 : 0);
