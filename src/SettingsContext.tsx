// src/SettingsContext.tsx
// App settings: appearance (theme mode, journal color, font), Face ID lock,
// daily reminder, backup bookkeeping, onboarded flag.
// Persisted via expo-sqlite/kv-store (same API as AsyncStorage, but backed
// by SQLite we already ship — no separate native dependency to version-match).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import Storage from 'expo-sqlite/kv-store';

const KEY = 'inkwell.settings.v1';

export type ThemeMode = 'system' | 'light' | 'dark';
export type FontChoice = 'serif' | 'sans' | 'mono';
export type PaletteId = 'ink' | 'forest' | 'plum' | 'sepia' | 'slate';

export interface ReminderSettings {
  enabled: boolean;
  hour: number; // 0-23 local
  minute: number; // 0-59
}

export interface Settings {
  onboarded: boolean;
  themeMode: ThemeMode;
  paletteId: PaletteId;
  font: FontChoice;
  lockEnabled: boolean;
  reminder: ReminderSettings;
  lastExportMs: number | null;
}

const DEFAULTS: Settings = {
  onboarded: false,
  themeMode: 'system',
  paletteId: 'ink',
  font: 'serif',
  lockEnabled: false,
  reminder: { enabled: false, hour: 21, minute: 0 },
  lastExportMs: null,
};

interface Ctx {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<Ctx>({
  settings: DEFAULTS,
  loaded: false,
  update: () => {},
});

export function SettingsProvider(props: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Storage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Settings>;
          setSettings({
            ...DEFAULTS,
            ...parsed,
            reminder: { ...DEFAULTS.reminder, ...(parsed.reminder ?? {}) },
          });
        }
      })
      .catch((e) => console.warn('settings load failed', e))
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        ...patch,
        reminder: { ...prev.reminder, ...(patch.reminder ?? {}) },
      };
      Storage.setItem(KEY, JSON.stringify(next)).catch((e) =>
        console.warn('settings save failed', e),
      );
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loaded, update }}>
      {props.children}
    </SettingsContext.Provider>
  );
}

export const useSettings = (): Ctx => useContext(SettingsContext);
