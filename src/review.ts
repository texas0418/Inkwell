// src/review.ts
// One polite App Store review ask, right after the writing is safely kept —
// never before a save, never on first launch. Eligible once the journal
// holds 5 or more entries. Asks at most once ever (kv flag; Apple further
// rate-limits on their side). Fail-open: if the native module is missing or
// throws, nothing happens.
// Adapted from Number Nine's proven src/review.ts — keep the guard below.

import Storage from 'expo-sqlite/kv-store';

const ASKED_KEY = 'inkwell.review.asked.v1';
const MIN_ENTRIES = 5;

function getStoreReview(): any | null {
  // Do NOT rely on try/catch around require() for fail-open here: when a
  // module's factory throws (native half missing from the binary), Metro's
  // guardedLoadModule reports it as a FATAL error itself — the exception
  // never reaches this catch, and a release build aborts. This bricked a
  // Number Nine device build on 2026-07-27. Check the native registry
  // BEFORE requiring so the factory can't throw.
  const native = (globalThis as any).expo?.modules?.ExpoStoreReview;
  if (!native) return null;
  try {
    const mod = require('expo-store-review');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

/** Request a review if eligible and never asked before. Safe to call often. */
export function maybeAskForReview(opts: { totalEntries: number }): void {
  if (opts.totalEntries < MIN_ENTRIES) return;
  try {
    if (Storage.getItemSync(ASKED_KEY)) return;
    const SR = getStoreReview();
    if (!SR) return;
    Storage.setItemSync(ASKED_KEY, String(Date.now()));
    // isAvailableAsync + requestReview both resolve quietly; the OS decides
    // whether anything is actually shown.
    SR.isAvailableAsync?.()
      .then((ok: boolean) => {
        if (ok) SR.requestReview?.();
      })
      .catch(() => {});
  } catch {
    /* fail open */
  }
}
