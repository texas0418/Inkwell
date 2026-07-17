// src/screens/OnboardingScreen.tsx
// One screen, one promise: your journal stays on your phone.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, serif } from '../theme';
import { useSettings } from '../SettingsContext';

export default function OnboardingScreen() {
  const { update } = useSettings();
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <Text style={styles.logo}>Inkwell</Text>
        <Text style={styles.tagline}>A private journal that stays yours.</Text>

        <View style={styles.points}>
          <Point title="On your phone, full stop.">
            Entries and photos live only on this device. No account, no cloud,
            no analytics — nothing to leak.
          </Point>
          <Point title="No subscription.">
            Writing is free forever. One optional one-time unlock for extras,
            and your data is never held hostage.
          </Point>
          <Point title="Yours to take anywhere.">
            Export your whole journal — photos included — to a single file,
            any time.
          </Point>
        </View>
      </View>

      <Pressable style={styles.cta} onPress={() => update({ onboarded: true })}>
        <Text style={styles.ctaText}>Start writing</Text>
      </Pressable>
    </View>
  );
}

function Point(props: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.point}>
      <Text style={styles.pointTitle}>{props.title}</Text>
      <Text style={styles.pointBody}>{props.children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 28, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center' },
  logo: {
    fontFamily: serif,
    fontSize: 44,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  points: { gap: 22 },
  point: {},
  pointTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  pointBody: { color: colors.textBody, fontSize: 14, lineHeight: 20, marginTop: 4 },
  cta: {
    backgroundColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
