// src/screens/SettingsScreen.tsx
// Pro unlock, backup export/import (never gated), privacy statement, and the
// double-confirmed delete-everything.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { countEntries, deleteAllData } from '../db';
import { applyBackup, exportBackup, pickBackup } from '../backup';
import { clearAllPhotoFiles } from '../photos';
import {
  isFailOpen,
  purchasePro,
  restorePurchases,
  useProAccess,
} from '../proAccess';
import { colors, serif } from '../theme';

export default function SettingsScreen(props: { onBack: () => void }) {
  const pro = useProAccess();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onExport = () =>
    run('export', async () => {
      await exportBackup();
    });

  const onImport = () =>
    run('import', async () => {
      const b = await pickBackup();
      if (!b) return;
      const photoCount = b.entries.reduce((n, e) => n + e.photos.length, 0);
      Alert.alert(
        'Replace journal?',
        `This backup contains ${b.entries.length} entries and ${photoCount} photos. Importing REPLACES everything currently in Inkwell.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () =>
              run('apply', async () => {
                await applyBackup(b);
                Alert.alert('Restored', 'Your journal has been restored from the backup.');
              }),
          },
        ],
      );
    });

  const onPurchase = () =>
    run('purchase', async () => {
      try {
        const ok = await purchasePro();
        if (ok) Alert.alert('Thank you!', 'Pro is unlocked — enjoy.');
      } catch (e: any) {
        if (!e?.userCancelled) throw e;
      }
    });

  const onRestore = () =>
    run('restore', async () => {
      const ok = await restorePurchases();
      Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Pro is active.' : 'No previous purchase was found.');
    });

  const onDeleteAll = () => {
    const n = countEntries();
    Alert.alert(
      'Delete everything?',
      `This permanently deletes all ${n} entries and their photos from this device. If you haven't exported a backup, they are gone for good.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'There is no undo.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, delete my journal',
                style: 'destructive',
                onPress: () =>
                  run('wipe', async () => {
                    deleteAllData();
                    await clearAllPhotoFiles();
                  }),
              },
            ]),
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={props.onBack} hitSlop={12}>
          <Text style={styles.backText}>‹ Journal</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Inkwell Pro</Text>
        <View style={styles.card}>
          {pro ? (
            <Text style={styles.bodyText}>
              {isFailOpen()
                ? 'Pro is unlocked in this build.'
                : 'Pro is unlocked. Thank you for supporting Inkwell!'}
            </Text>
          ) : (
            <>
              <Text style={styles.bodyText}>
                One purchase, yours forever — no subscription. Unlocks unlimited
                photos per entry. Writing, calendar, search and export are free
                forever either way.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={onPurchase} disabled={busy != null}>
                {busy === 'purchase' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Unlock Pro</Text>
                )}
              </Pressable>
            </>
          )}
          <Pressable onPress={onRestore} disabled={busy != null} hitSlop={6}>
            <Text style={styles.linkText}>Restore purchase</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Backup</Text>
        <View style={styles.card}>
          <Text style={styles.bodyText}>
            Your whole journal — photos included — in one file you keep wherever
            you like. Inkwell has no cloud; backups are how you move or protect
            your data.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={onExport} disabled={busy != null}>
            {busy === 'export' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Export backup…</Text>
            )}
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onImport} disabled={busy != null}>
            {busy === 'import' || busy === 'apply' ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.secondaryBtnText}>Import backup…</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.card}>
          <Text style={styles.bodyText}>
            Everything you write stays on this device. Inkwell has no account,
            no server, no analytics and makes no network requests with your
            data. The only copy of your journal is the one in your hands.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Danger zone</Text>
        <View style={styles.card}>
          <Pressable onPress={onDeleteAll} disabled={busy != null} hitSlop={6}>
            <Text style={styles.dangerText}>Delete all data…</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backText: { color: colors.ink, fontSize: 15 },
  headerTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  headerSpacer: { width: 60 },
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: {
    fontFamily: serif,
    color: colors.textPrimary,
    fontSize: 17,
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  bodyText: { color: colors.textBody, fontSize: 14, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.inkBorder,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  linkText: { color: colors.ink, fontSize: 13 },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
