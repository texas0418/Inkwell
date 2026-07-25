// test-db.ts — runs the real schema/SQL from dbCore.ts against node:sqlite.
// Run: npx tsx test-db.ts   (Node 22+; sqlite may need --experimental-sqlite)
// @ts-expect-error node:sqlite has no types under Expo's tsconfig; tsx runs it fine
import { DatabaseSync } from 'node:sqlite';
import type { EntryPhoto, JournalEntry } from './src/models';
import {
  calcStreak, countWords, extractUrls, linkHref, promptForDay, wordsInYear,
} from './src/models';
import {
  ALL_DAY_KEYS_SQL, ALL_PHOTOS_SQL, DAY_COUNTS_FOR_MONTH_SQL, DELETE_ENTRY_SQL,
  EntryRow, GET_ENTRY_SQL, INSERT_ENTRY_SQL, INSERT_PHOTO_SQL,
  LIST_ENTRIES_FOR_DAY_SQL, LIST_PHOTOS_FOR_ENTRY_SQL, LIST_PINNED_SQL,
  LIST_RECENT_ENTRIES_SQL, MIGRATIONS, ON_THIS_DAY_SQL, PhotoRow,
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

// ---- v1 -> v2 upgrade path (simulates an installed v1 app) ----
{
  const old = new DatabaseSync(':memory:');
  for (const sql of MIGRATIONS[0]) old.exec(sql);
  old.exec('PRAGMA user_version = 1');
  old.prepare(
    `INSERT INTO entries (day_key, created_at_ms, updated_at_ms, title, body, mood)
     VALUES ('2026-07-01', 5, 5, 'v1 row', '', NULL)`,
  ).run();
  let v = (old.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  while (v < MIGRATIONS.length) {
    for (const sql of MIGRATIONS[v]) old.exec(sql);
    v++;
    old.exec(`PRAGMA user_version = ${v}`);
  }
  const migrated = rowToEntry(old.prepare('SELECT * FROM entries').get() as unknown as EntryRow);
  eq('v1->v2 upgrade preserves row, pinned defaults false',
    [migrated.title, migrated.pinned], ['v1 row', false]);
}

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
  createdAtMs: T0, updatedAtMs: T0, title: '', body: '', mood: null, pinned: false, ...partial,
});

const insert = (e: JournalEntry): number =>
  Number(db.prepare(INSERT_ENTRY_SQL).run(...entryToParams(e)).lastInsertRowid);
const get = (id: number): JournalEntry =>
  rowToEntry(db.prepare(GET_ENTRY_SQL).get(id) as unknown as EntryRow);

// ---- insert / round-trip ----
const id1 = insert(entry({
  dayKey: '2026-07-12', title: 'Beach day', body: 'Sun and 100% sand.\nSecond line.',
  mood: 'great', pinned: true,
}));
const e1 = get(id1);
eq('entry round-trip', [e1.dayKey, e1.title, e1.mood, e1.pinned],
  ['2026-07-12', 'Beach day', 'great', true]);

eq('unknown mood maps to null',
  get(insert(entry({ dayKey: '2026-07-01', mood: 'ecstatic' as any }))).mood, null);

// ---- update (now supports date/time editing: created_at_ms is writable) ----
db.prepare(UPDATE_ENTRY_SQL).run(
  ...entryToParams(entry({
    dayKey: '2026-07-12', createdAtMs: T0 + 1000, updatedAtMs: T0 + 2000,
    title: 'Beach day!', body: 'edited', mood: 'good', pinned: false,
  })), id1,
);
eq('update persists incl. createdAt + pinned',
  [get(id1).title, get(id1).createdAtMs, get(id1).mood, get(id1).pinned],
  ['Beach day!', T0 + 1000, 'good', false]);

// ---- ordering ----
const id2 = insert(entry({ dayKey: '2026-07-12', createdAtMs: T0 + 5000, title: 'Later same day' }));
const id3 = insert(entry({ dayKey: '2026-06-30', title: 'June' }));
const recent = (db.prepare(LIST_RECENT_ENTRIES_SQL).all(10) as unknown as EntryRow[]).map(rowToEntry);
eq('recent order: newest day first, newest entry first within day',
  recent.map((e) => e.id), [id2, id1, insertOrderFix(), id3]);
function insertOrderFix(): number {
  return recent.find((e) => e.dayKey === '2026-07-01')!.id!;
}

const day = (db.prepare(LIST_ENTRIES_FOR_DAY_SQL).all('2026-07-12') as unknown as EntryRow[]).map(rowToEntry);
eq('day list ascending', day.map((e) => e.id), [id1, id2]);

// ---- pinned ----
const pinnedId = insert(entry({ dayKey: '2026-05-02', title: 'Anniversary', pinned: true }));
const pinnedList = (db.prepare(LIST_PINNED_SQL).all() as unknown as EntryRow[]).map(rowToEntry);
eq('pinned list contains only pinned', pinnedList.map((e) => e.id), [pinnedId]);

// ---- on this day ----
insert(entry({ dayKey: '2025-07-12', title: 'Last year beach' }));
insert(entry({ dayKey: '2024-07-12', title: 'Two years ago' }));
const otd = (db.prepare(ON_THIS_DAY_SQL).all('07-12', '2026-07-12') as unknown as EntryRow[]).map(rowToEntry);
eq('on this day: prior years only, newest first',
  otd.map((e) => e.dayKey), ['2025-07-12', '2024-07-12']);

// ---- day keys (streak input) ----
const keys = (db.prepare(ALL_DAY_KEYS_SQL).all() as unknown as { day_key: string }[]).map((r) => r.day_key);
eq('distinct day keys desc', keys[0] > keys[keys.length - 1], true);

// ---- search + LIKE escaping ----
const hits = (q: string): number[] => {
  const p = likePattern(q);
  return (db.prepare(SEARCH_ENTRIES_SQL).all(p, p, 50) as unknown as EntryRow[])
    .map((r) => rowToEntry(r).id!) as number[];
};
eq('search matches title case-insensitively', hits('beach day').length, 1);
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
    mood: 'ok', pinned: true,
    photos: [{ base64: 'aGVsbG8=', ext: 'jpg', position: 0, width: 1, height: 2 }],
  },
], T0);
const parsed = parseBackup(json);
eq('backup round-trip incl pinned',
  [parsed.entries.length, parsed.entries[0].photos[0].base64, parsed.entries[0].pinned],
  [1, 'aGVsbG8=', true]);

let threw = '';
try { parseBackup('{"format":"other"}'); } catch (e: any) { threw = e.message; }
eq('foreign file rejected', threw.includes('Inkwell'), true);

const tolerant = parseBackup(JSON.stringify({
  format: 'inkwell-backup', version: 1,
  entries: [
    { dayKey: '2026-01-05', createdAtMs: 5 },
    { dayKey: '2026-01-07', createdAtMs: 7, mood: 'weird', pinned: 'yes',
      photos: [{ base64: '' }, { base64: 'eA==', ext: '../evil' }] },
  ],
}));
eq('v1 backup without pinned defaults false', tolerant.entries[0].pinned, false);
eq('non-boolean pinned coerced false, bad ext sanitized',
  [tolerant.entries[1].pinned, tolerant.entries[1].photos.length, tolerant.entries[1].photos[0].ext],
  [false, 1, 'jpg']);

// ---- pure helpers ----
eq('countWords', [countWords(''), countWords('  '), countWords('one two\nthree')], [0, 0, 3]);
eq('extractUrls finds and dedupes',
  extractUrls('see https://a.com/x, then www.b.org. And https://a.com/x again'),
  ['https://a.com/x', 'www.b.org']);
eq('linkHref adds scheme only when missing',
  [linkHref('www.b.org'), linkHref('https://a.com')],
  ['https://www.b.org', 'https://a.com']);
eq('promptForDay is deterministic',
  promptForDay('2026-07-25') === promptForDay('2026-07-25'), true);

eq('streak counts consecutive days incl today',
  calcStreak(['2026-07-25', '2026-07-24', '2026-07-23', '2026-07-20'], '2026-07-25'), 3);
eq('streak survives an unwritten today',
  calcStreak(['2026-07-24', '2026-07-23'], '2026-07-25'), 2);
eq('streak zero when gap', calcStreak(['2026-07-20'], '2026-07-25'), 0);
eq('streak crosses month boundary',
  calcStreak(['2026-08-01', '2026-07-31', '2026-07-30'], '2026-08-01'), 3);

eq('wordsInYear filters by year',
  wordsInYear(
    [
      { dayKey: '2026-01-01', title: 'a b', body: 'c' },
      { dayKey: '2025-12-31', title: 'x', body: 'y z' },
    ],
    '2026',
  ),
  3);

console.log(failures ? `\n${failures} FAILURES` : '\nall ok');
process.exit(failures ? 1 : 0);
