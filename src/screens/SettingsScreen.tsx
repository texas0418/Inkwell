// src/screens/SettingsScreen.tsx
// Appearance (day/night, journal color, font), Face ID lock, daily reminder,
// Pro unlock, backup export/import (never gated) + PDF export (Pro), privacy
// statement, and the double-confirmed delete-everything.

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import { countEntries, deleteAllData } from '../db';
import { applyBackup, exportBackup, pickBackup } from '../backup';
import { exportJournalPdf } from '../pdf';
import {
  cancelReminder,
  ensureNotificationPermission,
  scheduleDailyReminder,
} from '../notifications';
import { clearAllPhotoFiles } from '../photos';
import {
  isFailOpen,
  purchasePro,
  restorePurchases,
  useProAccess,
} from '../proAccess';
import {
  FontChoice,
  PaletteId,
  ThemeMode,
  useSettings,
} from '../SettingsContext';
import {
  FONT_CHOICES,
  PALETTES,
  PALETTE_IDS,
  Palette,
  ThemeFonts,
  useTheme,
} from '../theme';

const THEME_CHOICES: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Day' },
  { mode: 'dark', label: 'Night' },
];

const pad2 = (n: number) => n.toString().padStart(2, '0');

// eslint-disable-next-line max-lines-per-function -- tech-debt #3
export default function SettingsScreen(props: { onBack: () => void }) {
  const pro = useProAccess();
  const { settings, update } = useSettings();
  const { colors: c, fonts, statusBarStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c, fonts), [c, fonts]);
  const [busy, setBusy] = useState<string | null>(null);
  const [hourText, setHourText] = useState(pad2(settings.reminder.hour));
  const [minText, setMinText] = useState(pad2(settings.reminder.minute));

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

  // ------------------------------------------------------------- appearance

  const setMode = (mode: ThemeMode) => update({ themeMode: mode });
  const setPalette = (paletteId: PaletteId) => update({ paletteId });
  const setFont = (font: FontChoice) => update({ font });

  // --------------------------------------------------------------- security

  const toggleLock = (next: boolean) =>
    run('lock', async () => {
      if (!next) {
        update({ lockEnabled: false });
        return;
      }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) {
        Alert.alert(
          'No Face ID or passcode found',
          'Set up Face ID (or a device passcode) in iOS Settings first, so you can always get back into your journal.',
        );
        return;
      }
      // Prove it works once before turning it on — never lock the user out.
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable journal lock',
      });
      if (res.success) update({ lockEnabled: true });
    });

  // --------------------------------------------------------------- reminder

  const applyReminder = (enabled: boolean, hour: number, minute: number) =>
    run('reminder', async () => {
      if (!enabled) {
        await cancelReminder();
        update({ reminder: { enabled: false, hour, minute } });
        return;
      }
      const ok = await ensureNotificationPermission();
      if (!ok) {
        Alert.alert(
          'Notifications are off',
          'Allow notifications for Inkwell in iOS Settings to get a daily writing reminder.',
        );
        return;
      }
      await scheduleDailyReminder(hour, minute);
      update({ reminder: { enabled: true, hour, minute } });
    });

  const commitReminderTime = () => {
    const hour = Math.min(23, Math.max(0, parseInt(hourText, 10) || 0));
    const minute = Math.min(59, Math.max(0, parseInt(minText, 10) || 0));
    setHourText(pad2(hour));
    setMinText(pad2(minute));
    applyReminder(settings.reminder.enabled, hour, minute);
  };

  // ----------------------------------------------------------------- backup

  const onExport = () =>
    run('export', async () => {
      await exportBackup();
      update({ lastExportMs: Date.now() });
    });

  const onExportPdf = () => {
    if (!pro) {
      Alert.alert(
        'PDF export is a Pro feature',
        'Your data is never locked in — the JSON backup is always free. The typeset PDF edition is part of Pro.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Unlock Pro', onPress: () => purchasePro().catch(() => {}) },
        ],
      );
      return;
    }
    run('pdf', async () => {
      await exportJournalPdf();
    });
  };

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
      Alert.alert(
        ok ? 'Restored' : 'Nothing to restore',
        ok ? 'Pro is active.' : 'No previous purchase was found.',
      );
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

  const lastExportLabel =
    settings.lastExportMs == null
      ? 'Never exported'
      : `Last export: ${new Date(settings.lastExportMs).toLocaleDateString()}`;

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.header}>
        <Pressable onPress={props.onBack} hitSlop={12}>
          <Text style={styles.backText}>‹ Journal</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <Text style={styles.rowLabel}>View</Text>
          <View style={styles.segRow}>
            {THEME_CHOICES.map((t) => (
              <Pressable
                key={t.mode}
                onPress={() => setMode(t.mode)}
                style={[styles.seg, settings.themeMode === t.mode && styles.segOn]}
              >
                <Text
                  style={[styles.segText, settings.themeMode === t.mode && styles.segTextOn]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.rowLabel}>Journal color</Text>
          <View style={styles.paletteRow}>
            {PALETTE_IDS.map((id) => (
              <Pressable key={id} onPress={() => setPalette(id)} style={styles.paletteItem}>
                <View
                  style={[
                    styles.paletteDot,
                    { backgroundColor: PALETTES[id].swatch },
                    settings.paletteId === id && styles.paletteDotOn,
                  ]}
                />
                <Text
                  style={[
                    styles.paletteLabel,
                    settings.paletteId === id && styles.paletteLabelOn,
                  ]}
                >
                  {PALETTES[id].label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.rowLabel}>Font</Text>
          <View style={styles.segRow}>
            {FONT_CHOICES.map((fc) => (
              <Pressable
                key={fc.key}
                onPress={() => setFont(fc.key)}
                style={[styles.seg, settings.font === fc.key && styles.segOn]}
              >
                <Text
                  style={[styles.segText, settings.font === fc.key && styles.segTextOn]}
                >
                  {fc.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Privacy &amp; security</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.rowTitle}>Lock journal</Text>
              <Text style={styles.rowSub}>
                Require Face ID (or your passcode) to open Inkwell.
              </Text>
            </View>
            <Switch
              value={settings.lockEnabled}
              onValueChange={toggleLock}
              trackColor={{ true: c.accent }}
              disabled={busy != null}
            />
          </View>
          <View style={styles.hairline} />
          <Text style={styles.bodyText}>
            Everything you write stays on this device. Inkwell has no account,
            no server, no analytics and makes no network requests with your
            data.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Daily reminder</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.rowTitle}>Remind me to write</Text>
              <Text style={styles.rowSub}>A local notification — nothing leaves the phone.</Text>
            </View>
            <Switch
              value={settings.reminder.enabled}
              onValueChange={(v) =>
                applyReminder(v, settings.reminder.hour, settings.reminder.minute)
              }
              trackColor={{ true: c.accent }}
              disabled={busy != null}
            />
          </View>
          {settings.reminder.enabled && (
            <View style={styles.timeRow}>
              <TextInput
                style={styles.timeInput}
                value={hourText}
                onChangeText={(t) => setHourText(t.replace(/\D/g, '').slice(0, 2))}
                onBlur={commitReminderTime}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <Text style={styles.colon}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={minText}
                onChangeText={(t) => setMinText(t.replace(/\D/g, '').slice(0, 2))}
                onBlur={commitReminderTime}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <Text style={styles.timeHint}>24-hour time</Text>
            </View>
          )}
        </View>

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
                One $9.99 purchase, yours forever — no subscription. Unlocks
                unlimited photos &amp; drawings per entry, On This Day, and PDF
                export. Writing, calendar, search and backups are free forever
                either way.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={onPurchase} disabled={busy != null}>
                {busy === 'purchase' ? (
                  <ActivityIndicator color={c.accentText} />
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
            your data. <Text style={styles.mutedText}>{lastExportLabel}.</Text>
          </Text>
          <Pressable style={styles.primaryBtn} onPress={onExport} disabled={busy != null}>
            {busy === 'export' ? (
              <ActivityIndicator color={c.accentText} />
            ) : (
              <Text style={styles.primaryBtnText}>Export backup…</Text>
            )}
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onImport} disabled={busy != null}>
            {busy === 'import' || busy === 'apply' ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <Text style={styles.secondaryBtnText}>Import backup…</Text>
            )}
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onExportPdf} disabled={busy != null}>
            {busy === 'pdf' ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <Text style={styles.secondaryBtnText}>
                Export as PDF…{pro ? '' : '  (Pro)'}
              </Text>
            )}
          </Pressable>
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

const makeStyles = (c: Palette, f: ThemeFonts) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backText: { color: c.accent, fontSize: 15 },
    headerTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
    headerSpacer: { width: 60 },
    content: { padding: 20, paddingBottom: 48 },
    sectionTitle: {
      fontFamily: f.title,
      color: c.textPrimary,
      fontSize: 17,
      marginTop: 18,
      marginBottom: 8,
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 12,
      padding: 14,
      gap: 12,
    },
    bodyText: { color: c.textBody, fontSize: 14, lineHeight: 20 },
    mutedText: { color: c.textMuted, fontSize: 13 },
    rowLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    segRow: { flexDirection: 'row', gap: 8 },
    seg: {
      flex: 1,
      borderRadius: 9,
      paddingVertical: 9,
      alignItems: 'center',
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    segOn: { backgroundColor: c.accentSoft, borderColor: c.accentBorder },
    segText: { color: c.textMuted, fontSize: 13 },
    segTextOn: { color: c.accent, fontWeight: '600' },
    paletteRow: { flexDirection: 'row', justifyContent: 'space-between' },
    paletteItem: { alignItems: 'center', gap: 5, flex: 1 },
    paletteDot: { width: 34, height: 34, borderRadius: 17 },
    paletteDotOn: { borderWidth: 3, borderColor: c.textPrimary },
    paletteLabel: { color: c.textMuted, fontSize: 11 },
    paletteLabelOn: { color: c.textPrimary, fontWeight: '600' },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    switchText: { flex: 1 },
    rowTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
    rowSub: { color: c.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
    hairline: { height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 8,
      width: 52,
      paddingVertical: 8,
      textAlign: 'center',
      fontSize: 17,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    colon: { color: c.textPrimary, fontSize: 17, fontWeight: '600' },
    timeHint: { color: c.textMuted, fontSize: 11, marginLeft: 8 },
    primaryBtn: {
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryBtnText: { color: c.accentText, fontSize: 15, fontWeight: '600' },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: c.accentBorder,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryBtnText: { color: c.accent, fontSize: 15, fontWeight: '600' },
    linkText: { color: c.accent, fontSize: 13 },
    dangerText: { color: c.danger, fontSize: 15, fontWeight: '600' },
  });
