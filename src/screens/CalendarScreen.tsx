// src/screens/CalendarScreen.tsx
// Month view: dots on days with entries. Tap a day to see its entries below
// and add one for that date (backfilling old days is a journal staple).

import React, { useCallback, useEffect, useState } from 'react';
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
import { colors, serif } from '../theme';
import MonthGrid from '../components/MonthGrid';

export default function CalendarScreen(props: {
  onBack: () => void;
  onOpenEntry: (entryId: number, dayKey: string) => void;
  onNewEntry: (dayKey: string) => void;
}) {
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
      <StatusBar style="dark" />
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 14,
  },
  chev: { color: colors.textBody, fontSize: 26, paddingHorizontal: 8 },
  monthLabel: {
    fontFamily: serif,
    color: colors.textPrimary,
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
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  addText: { color: colors.ink, fontSize: 14 },
  emptyText: { color: colors.textMuted, fontSize: 13, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: serif, color: colors.textPrimary, fontSize: 15 },
  rowSnippet: { color: colors.textBody, fontSize: 12, marginTop: 2 },
  rowTime: { color: colors.textMuted, fontSize: 12 },
});
