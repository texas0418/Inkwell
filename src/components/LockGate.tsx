// src/components/LockGate.tsx
// Face ID / passcode gate. When lock is enabled, a lock screen covers the
// journal and requires biometric (or device passcode fallback) on launch and
// whenever the app returns from the background. It covers the app instead of
// replacing it, so an entry being written is still open after unlocking. Fail-open if the device has no biometrics
// or none enrolled — never brick the user's own journal.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSettings } from '../SettingsContext';
import { Palette, useTheme } from '../theme';

export default function LockGate(props: { children: React.ReactNode }) {
  const { settings, loaded } = useSettings();
  const { colors: c, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [locked, setLocked] = useState(false);
  const authInFlight = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (authInFlight.current) return;
    authInFlight.current = true;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) {
        // Fail-open: no way to authenticate on this device.
        setLocked(false);
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock your journal',
      });
      if (res.success) setLocked(false);
    } catch (e) {
      console.warn('auth failed', e);
    } finally {
      authInFlight.current = false;
    }
  }, []);

  // Lock on cold start (once settings are loaded) …
  useEffect(() => {
    if (loaded && settings.lockEnabled) {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tech-debt #4
      setLocked(true);
      tryUnlock();
    }
  }, [loaded, settings.lockEnabled, tryUnlock]);

  // … and again whenever the app has been backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && settings.lockEnabled) {
        Keyboard.dismiss();
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [settings.lockEnabled]);

  const showLock = settings.lockEnabled && locked;

  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        accessibilityElementsHidden={showLock}
        importantForAccessibility={showLock ? 'no-hide-descendants' : 'auto'}
      >
        {props.children}
      </View>
      {showLock && (
        <View style={[StyleSheet.absoluteFill, styles.root]}>
          <Text style={[styles.logo, { fontFamily: fonts.title }]}>Inkwell</Text>
          <Text style={styles.hint}>Your journal is locked.</Text>
          <Pressable style={styles.btn} onPress={tryUnlock}>
            <Text style={styles.btnText}>Unlock</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    fill: { flex: 1 },
    root: {
      flex: 1,
      backgroundColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    logo: { fontSize: 38, color: c.textPrimary },
    hint: { color: c.textMuted, fontSize: 14, marginBottom: 12 },
    btn: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 42,
    },
    btnText: { color: c.accentText, fontSize: 15, fontWeight: '600' },
  });
