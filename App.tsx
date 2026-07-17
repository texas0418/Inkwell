import { useEffect, useState } from 'react';
import JournalScreen from './src/screens/JournalScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import EditorScreen from './src/screens/EditorScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { SettingsProvider, useSettings } from './src/SettingsContext';
import { initPurchases } from './src/proAccess';

type Screen =
  | { name: 'journal' }
  | { name: 'calendar' }
  | { name: 'settings' }
  | { name: 'editor'; entryId: number | null; dayKey: string; from: 'journal' | 'calendar' };

function Root() {
  const { settings, loaded } = useSettings();
  const [screen, setScreen] = useState<Screen>({ name: 'journal' });
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
      <Root />
    </SettingsProvider>
  );
}
