// src/screens/CalendarScreen.tsx
// Month view: dots on days with entries. Tap a day to see its entries below
// and add one for that date (backfilling old days is a journal staple).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { dayCountsForMonth, listEntriesForDay } from '../db';
import {
  JournalEntry,
  displayTitle,
  formatClock,
  formatDayLabel,
  formatMonthLabel,
  moodEmoji,
  monthPrefix,
  snippet,
  todayKey,
} from '../models';
import { Palette, ThemeFonts, useTheme } from '../theme';
import MonthGrid from '../components/MonthGrid';

export default function CalendarScreen(props: {
  onBack: () => void;
  onOpenEntry: (entryId: number, dayKey: string) => void;
  onNewEntry: (dayKey: string) => void;
}) {
  const { colors: c, fonts, statusBarStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c, fonts), [c, fonts]);
  const now = Date.now();
  const [ym, setYm] = useState(() => {
    const d = new Date(now);
    return { year: d.getFullYear(), month0: d.getMonth() };
  });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string>(todayKey(now));
  const [dayEntries, setDayEntries] = useState<JournalEntry[]>([]);

  const load = useCallback(() => {
    setCounts(dayCountsForMonth(monthPrefix(ym.year, ym.month0)));
    setDayEntries(listEntriesForDay(selected));
  }, [ym, selected]);

  useEffect(load, [load]);

  const shiftMonth = (delta: number) => {
    setYm((prev) => {
      const d = new Date(prev.year, prev.month0 + delta, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.header}>
        <Pressable onPress={props.onBack} hitSlop={12}>
          <Text style={styles.backText}>‹ Journal</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={12}>
          <Text style={styles.chev}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(ym.year, ym.month0)}</Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={12}>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>

      <View style={styles.gridWrap}>
        <MonthGrid
          year={ym.year}
          month0={ym.month0}
          counts={counts}
          selected={selected}
          onSelectDay={setSelected}
        />
      </View>

      <ScrollView contentContainerStyle={styles.dayList}>
        <View style={styles.dayHeaderRow}>
          <Text style={styles.dayHeader}>{formatDayLabel(selected, now)}</Text>
          <Pressable onPress={() => props.onNewEntry(selected)} hitSlop={8}>
            <Text style={styles.addText}>＋ New entry</Text>
          </Pressable>
        </View>
        {dayEntries.length === 0 && (
          <Text style={styles.emptyText}>Nothing written this day.</Text>
        )}
        {dayEntries.map((e) => (
          <Pressable
            key={e.id}
            style={styles.row}
            onPress={() => e.id != null && props.onOpenEntry(e.id, e.dayKey)}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {e.pinned ? <Text style={styles.rowStar}>★ </Text> : null}
                {moodEmoji(e.mood) ? `${moodEmoji(e.mood)} ` : ''}
                {displayTitle(e)}
              </Text>
              {snippet(e.body) !== '' && (
                <Text style={styles.rowSnippet} numberOfLines={1}>
                  {snippet(e.body)}
                </Text>
              )}
            </View>
            <Text style={styles.rowTime}>{formatClock(e.createdAtMs)}</Text>
          </Pressable>
        ))}
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
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      paddingVertical: 14,
    },
    chev: { color: c.textBody, fontSize: 26, paddingHorizontal: 8 },
    monthLabel: {
      fontFamily: f.title,
      color: c.textPrimary,
      fontSize: 18,
      minWidth: 170,
      textAlign: 'center',
    },
    gridWrap: { paddingHorizontal: 16 },
    dayList: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 },
    dayHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    dayHeader: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    addText: { color: c.accent, fontSize: 14 },
    emptyText: { color: c.textMuted, fontSize: 13, paddingVertical: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    rowText: { flex: 1 },
    rowTitle: { fontFamily: f.title, color: c.textPrimary, fontSize: 15 },
    rowStar: { color: c.proGold },
    rowSnippet: { color: c.textBody, fontSize: 12, marginTop: 2 },
    rowTime: { color: c.textMuted, fontSize: 12 },
  });
