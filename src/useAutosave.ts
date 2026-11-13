// src/useAutosave.ts
// Keeps an open entry saved while it is being written, so nothing depends on
// tapping Done: a short pause in typing saves, and so does the app leaving the
// foreground (screen lock, app switch) or the editor unmounting.

import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const PAUSE_MS = 1500;

/**
 * `save` must be idempotent (insert once, update after). `contentKey` changes
 * whenever the entry's content does; nothing is tracked until `enabled`, and
 * the first enabled key is the baseline, so opening an entry never re-saves it.
 * Returns `stop` to end autosaving (after Done or delete).
 */
export function useAutosave(save: () => void, contentKey: string, enabled: boolean) {
  const saveRef = useRef(save);
  const stopped = useRef(false);
  const dirty = useRef(false);
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(() => {
    if (stopped.current || !dirty.current) return;
    dirty.current = false;
    try {
      saveRef.current();
    } catch (e) {
      dirty.current = true;
      console.warn('autosave failed', e);
    }
  }, []);

  const stop = useCallback(() => {
    stopped.current = true;
  }, []);

  // A pause in typing saves.
  useEffect(() => {
    if (!enabled) return;
    if (baseline.current === null) {
      baseline.current = contentKey;
      return;
    }
    if (contentKey === baseline.current) return;
    baseline.current = contentKey;
    dirty.current = true;
    const t = setTimeout(flush, PAUSE_MS);
    return () => clearTimeout(t);
  }, [contentKey, enabled, flush]);

  // Leaving the foreground (screen lock, app switch) saves at once.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => sub.remove();
  }, [flush]);

  // Unmounting for any reason saves what is left.
  useEffect(() => flush, [flush]);

  return { stop };
}
