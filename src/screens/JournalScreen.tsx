// src/screens/JournalScreen.tsx
// Home: the journal itself. Recent entries newest-first, search, an Important
// filter, streak/word stats, On This Day (Pro), a backup nudge when exports
// go stale, and the ever-present write button.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  getAllDayKeys,
  getAllEntries,
  getCoverPhotos,
  listOnThisDay,
  listPinnedEntries,
  listRecentEntries,
  searchEntries,
} from '../db';
import {
  EntryPhoto,
  JournalEntry,
  calcStreak,
  displayTitle,
  formatDayLabel,
  moodEmoji,
  snippet,
  todayKey,
  wordsInYear,
} from '../models';
import { photoUri } from '../photos';
import { useProAccess, purchasePro } from '../proAccess';
import { useSettings } from '../SettingsContext';
import { Palette, ThemeFonts, useTheme } from '../theme';

const RECENT_LIMIT = 300;
const SEARCH_LIMIT = 100;
const NUDGE_AFTER_MS = 30 * 24 * 3600 * 1000; // 30 days

// eslint-disable-next-line complexity -- tech-debt #3
export default function JournalScreen(props: {
  onCalendar: () => void;
  onSettings: () => void;
  onOpenEntry: (entryId: number, dayKey: string) => void;
  onNewEntry: (dayKey: string) => void;
}) {
  const pro = useProAccess();
  const { settings } = useSettings();
  const { colors: c, fonts, statusBarStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c, fonts), [c, fonts]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [covers, setCovers] = useState<Map<number, EntryPhoto>>(new Map());
  const [query, setQuery] = useState('');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [onThisDay, setOnThisDay] = useState<JournalEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [yearWords, setYearWords] = useState(0);

  const now = Date.now();
  const today = todayKey(now);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- tech-debt #4
  const load = useCallback(() => {
    const q = query.trim();
    setEntries(
      q
        ? searchEntries(q, SEARCH_LIMIT)
        : onlyPinned
          ? listPinnedEntries()
          : listRecentEntries(RECENT_LIMIT),
    );
    setCovers(getCoverPhotos());
    setOnThisDay(listOnThisDay(today));
    setStreak(calcStreak(getAllDayKeys(), today));
    setYearWords(wordsInYear(getAllEntries(), today.slice(0, 4)));
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- tech-debt #4
  }, [query, onlyPinned, today]);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- tech-debt #4
  useEffect(load, [load]);

  const searching = query.trim().length > 0;
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- tech-debt #4
  const hasToday = useMemo(
    () => entries.some((e) => e.dayKey === today),
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- tech-debt #4
    [entries, today],
  );
  const showNudge =
    entries.length > 0 &&
    (settings.lastExportMs == null || now - settings.lastExportMs > NUDGE_AFTER_MS);

  const openOnThisDay = () => {
    const top = onThisDay[0];
    if (!top) return;
    if (!pro) {
      Alert.alert(
        'On This Day is a Pro feature',
        'See what you wrote on this day in past years. One $9.99 purchase, no subscription.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Unlock Pro',
            onPress: () => purchasePro().catch(() => {}),
          },
        ],
      );
      return;
    }
    if (top.id != null) props.onOpenEntry(top.id, top.dayKey);
  };

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.header}>
        <Text style={styles.logo}>Inkwell</Text>
        <View style={styles.headerButtons}>
          <Pressable onPress={props.onCalendar} hitSlop={10}>
            <Text style={styles.headerBtnText}>Calendar</Text>
          </Pressable>
          <Pressable onPress={props.onSettings} hitSlop={10}>
            <Text style={styles.headerBtnText}>Settings</Text>
          </Pressable>
        </View>
      </View>

      {entries.length > 0 && !searching && (
        <Text style={styles.statsLine}>
          {streak > 0 ? `${streak}-day streak · ` : ''}
          {yearWords.toLocaleString()} words this year
        </Text>
      )}

      <TextInput
        style={styles.search}
        placeholder="Search your journal…"
        placeholderTextColor={c.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setOnlyPinned(false)}
          style={[styles.filterChip, !onlyPinned && styles.filterChipOn]}
        >
          <Text style={[styles.filterText, !onlyPinned && styles.filterTextOn]}>All</Text>
        </Pressable>
        <Pressable
          onPress={() => setOnlyPinned(true)}
          style={[styles.filterChip, onlyPinned && styles.filterChipOn]}
        >
          <Text style={[styles.filterText, onlyPinned && styles.filterTextOn]}>
            ★ Important
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {showNudge && (
              <Pressable style={styles.nudge} onPress={props.onSettings}>
                <Text style={styles.nudgeText}>
                  It&apos;s been a while since your last backup — everything lives only on
                  this phone. <Text style={styles.nudgeLink}>Export now ›</Text>
                </Text>
              </Pressable>
            )}
            {onThisDay.length > 0 && !searching && !onlyPinned && (
              <Pressable style={styles.otdCard} onPress={openOnThisDay}>
                <Text style={styles.otdLabel}>
                  On this day · {formatDayLabel(onThisDay[0].dayKey, now)}
                  {!pro ? '  ·  Pro' : ''}
                </Text>
                <Text style={styles.otdTitle} numberOfLines={1}>
                  {moodEmoji(onThisDay[0].mood) ? `${moodEmoji(onThisDay[0].mood)} ` : ''}
                  {displayTitle(onThisDay[0])}
                </Text>
                {onThisDay.length > 1 && (
                  <Text style={styles.otdMore}>
                    +{onThisDay.length - 1} more from past years
                  </Text>
                )}
              </Pressable>
            )}
          </>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searching
              ? 'No entries match that search.'
              : onlyPinned
                ? 'Nothing marked important yet — tap ☆ in an entry.'
                : 'Your journal is empty. Today is a fine place to start.'}
          </Text>
        }
        renderItem={({ item, index }) => {
          const showDay = index === 0 || entries[index - 1].dayKey !== item.dayKey;
          const cover = item.id != null ? covers.get(item.id) : undefined;
          return (
            <View>
              {showDay && (
                <Text style={styles.dayHeader}>{formatDayLabel(item.dayKey, now)}</Text>
              )}
              <Pressable
                style={styles.card}
                onPress={() => item.id != null && props.onOpenEntry(item.id, item.dayKey)}
              >
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.pinned ? <Text style={styles.cardStar}>★ </Text> : null}
                    {moodEmoji(item.mood) ? `${moodEmoji(item.mood)} ` : ''}
                    {displayTitle(item)}
                  </Text>
                  {snippet(item.body) !== '' && (
                    <Text style={styles.cardSnippet} numberOfLines={2}>
                      {snippet(item.body)}
                    </Text>
                  )}
                </View>
                {cover && (
                  <Image
                    source={{ uri: photoUri(cover.fileName) }}
                    style={styles.thumb}
                  />
                )}
              </Pressable>
            </View>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => props.onNewEntry(today)}>
        <Text style={styles.fabText}>{hasToday ? '＋ New entry' : '✎ Write today'}</Text>
      </Pressable>
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
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    logo: { fontFamily: f.title, fontSize: 26, color: c.textPrimary },
    headerButtons: { flexDirection: 'row', gap: 16 },
    headerBtnText: { color: c.accent, fontSize: 14 },
    statsLine: {
      color: c.textMuted,
      fontSize: 12,
      paddingHorizontal: 20,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    search: {
      marginHorizontal: 20,
      marginTop: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14,
      color: c.textPrimary,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      marginTop: 10,
    },
    filterChip: {
      borderRadius: 15,
      paddingVertical: 5,
      paddingHorizontal: 14,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    filterChipOn: { backgroundColor: c.accentSoft, borderColor: c.accentBorder },
    filterText: { color: c.textMuted, fontSize: 13 },
    filterTextOn: { color: c.accent, fontWeight: '600' },
    list: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 110 },
    nudge: {
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accentBorder,
      borderRadius: 10,
      padding: 10,
      marginTop: 10,
    },
    nudgeText: { color: c.textBody, fontSize: 12, lineHeight: 17 },
    nudgeLink: { color: c.accent, fontWeight: '600' },
    otdCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.accentBorder,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
    },
    otdLabel: {
      color: c.accent,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 3,
    },
    otdTitle: { fontFamily: f.title, fontSize: 15, color: c.textPrimary },
    otdMore: { color: c.textMuted, fontSize: 11, marginTop: 3 },
    dayHeader: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 16,
      marginBottom: 6,
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    cardText: { flex: 1 },
    cardTitle: { fontFamily: f.title, fontSize: 16, color: c.textPrimary },
    cardStar: { color: c.proGold },
    cardSnippet: {
      fontFamily: f.body,
      color: c.textBody,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 3,
    },
    thumb: {
      width: 52,
      height: 52,
      borderRadius: 8,
      backgroundColor: c.hairline,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 48,
      paddingHorizontal: 24,
      lineHeight: 20,
    },
    fab: {
      position: 'absolute',
      bottom: 34,
      alignSelf: 'center',
      backgroundColor: c.accent,
      borderRadius: 26,
      paddingVertical: 14,
      paddingHorizontal: 26,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    fabText: { color: c.accentText, fontSize: 15, fontWeight: '600' },
  });
