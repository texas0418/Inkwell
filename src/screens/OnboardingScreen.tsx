// src/screens/OnboardingScreen.tsx
// One screen, one promise: your journal stays on your phone.

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Palette, ThemeFonts, useTheme } from '../theme';
import { useSettings } from '../SettingsContext';

export default function OnboardingScreen() {
  const { update } = useSettings();
  const { colors: c, fonts, statusBarStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c, fonts), [c, fonts]);
  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.center}>
        <Text style={styles.logo}>Inkwell</Text>
        <Text style={styles.tagline}>A private journal that stays yours.</Text>

        <View style={styles.points}>
          <View>
            <Text style={styles.pointTitle}>On your phone, full stop.</Text>
            <Text style={styles.pointBody}>
              Entries and photos live only on this device. No account, no cloud,
              no analytics — nothing to leak.
            </Text>
          </View>
          <View>
            <Text style={styles.pointTitle}>No subscription.</Text>
            <Text style={styles.pointBody}>
              Writing is free forever. One optional one-time unlock for extras,
              and your data is never held hostage.
            </Text>
          </View>
          <View>
            <Text style={styles.pointTitle}>Yours to take anywhere.</Text>
            <Text style={styles.pointBody}>
              Export your whole journal — photos included — to a single file,
              any time.
            </Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.cta} onPress={() => update({ onboarded: true })}>
        <Text style={styles.ctaText}>Start writing</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Palette, f: ThemeFonts) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg, padding: 28, paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center' },
    logo: {
      fontFamily: f.title,
      fontSize: 44,
      color: c.textPrimary,
      textAlign: 'center',
    },
    tagline: {
      color: c.textMuted,
      fontSize: 15,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 40,
    },
    points: { gap: 22 },
    pointTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
    pointBody: { color: c.textBody, fontSize: 14, lineHeight: 20, marginTop: 4 },
    cta: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    ctaText: { color: c.accentText, fontSize: 16, fontWeight: '600' },
  });
