import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import JournalScreen from './src/screens/JournalScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import EditorScreen from './src/screens/EditorScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LockGate from './src/components/LockGate';
import { SettingsProvider, useSettings } from './src/SettingsContext';
import { initPurchases } from './src/proAccess';
import './src/notifications'; // installs the foreground notification handler

type Screen =
  | { name: 'journal' }
  | { name: 'calendar' }
  | { name: 'settings' }
  | { name: 'editor'; entryId: number | null; dayKey: string; from: 'journal' | 'calendar' };

function Root() {
  const { settings, loaded } = useSettings();
  const [screen, setScreen] = useState<Screen>({ name: 'journal' });

  // Deep links: inkwell://goto/<journal|calendar|settings|today|entry?id=N&day=K>.
  // Used by the screenshot pipeline; harmless in normal use (just navigation).
  useEffect(() => {
    const handle = (url: string | null) => {
      const m = url ? /goto\/(\w+)(?:\?(.*))?/.exec(url) : null;
      if (!m) return;
      const q = new URLSearchParams(m[2] ?? '');
      if (m[1] === 'journal') setScreen({ name: 'journal' });
      else if (m[1] === 'calendar') setScreen({ name: 'calendar' });
      else if (m[1] === 'settings') setScreen({ name: 'settings' });
      else if (m[1] === 'today')
        setScreen({
          name: 'editor',
          entryId: null,
          dayKey: new Date().toISOString().slice(0, 10),
          from: 'journal',
        });
      else if (m[1] === 'entry' && q.get('id') && q.get('day'))
        setScreen({
          name: 'editor',
          entryId: Number(q.get('id')),
          dayKey: q.get('day')!,
          from: 'journal',
        });
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  if (!loaded) return null;
  if (!settings.onboarded) return <OnboardingScreen />;

  if (screen.name === 'editor') {
    const back = () =>
      setScreen(screen.from === 'calendar' ? { name: 'calendar' } : { name: 'journal' });
    return (
      <EditorScreen
        entryId={screen.entryId}
        dayKey={screen.dayKey}
        onDone={back}
      />
    );
  }
  if (screen.name === 'calendar') {
    return (
      <CalendarScreen
        onBack={() => setScreen({ name: 'journal' })}
        onOpenEntry={(entryId, dayKey) =>
          setScreen({ name: 'editor', entryId, dayKey, from: 'calendar' })
        }
        onNewEntry={(dayKey) =>
          setScreen({ name: 'editor', entryId: null, dayKey, from: 'calendar' })
        }
      />
    );
  }
  if (screen.name === 'settings') {
    return <SettingsScreen onBack={() => setScreen({ name: 'journal' })} />;
  }
  return (
    <JournalScreen
      onCalendar={() => setScreen({ name: 'calendar' })}
      onSettings={() => setScreen({ name: 'settings' })}
      onOpenEntry={(entryId, dayKey) =>
        setScreen({ name: 'editor', entryId, dayKey, from: 'journal' })
      }
      onNewEntry={(dayKey) =>
        setScreen({ name: 'editor', entryId: null, dayKey, from: 'journal' })
      }
    />
  );
}

export default function App() {
  useEffect(() => {
    // Fail-open: unlocks Pro immediately in Expo Go / placeholder builds.
    initPurchases();
  }, []);
  return (
    <SettingsProvider>
      <LockGate>
        <Root />
      </LockGate>
    </SettingsProvider>
  );
}
