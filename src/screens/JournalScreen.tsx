// src/screens/JournalScreen.tsx
// Home: the journal itself. Recent entries newest-first, search, and the
// ever-present nib button to write today's entry.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getCoverPhotos, listRecentEntries, searchEntries } from '../db';
import {
  EntryPhoto,
  JournalEntry,
  displayTitle,
  formatDayLabel,
  moodEmoji,
  snippet,
  todayKey,
} from '../models';
import { photoUri } from '../photos';
import { colors, serif } from '../theme';

const RECENT_LIMIT = 300;
const SEARCH_LIMIT = 100;

export default function JournalScreen(props: {
  onCalendar: () => void;
  onSettings: () => void;
  onOpenEntry: (entryId: number, dayKey: string) => void;
  onNewEntry: (dayKey: string) => void;
}) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [covers, setCovers] = useState<Map<number, EntryPhoto>>(new Map());
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    const q = query.trim();
    setEntries(q ? searchEntries(q, SEARCH_LIMIT) : listRecentEntries(RECENT_LIMIT));
    setCovers(getCoverPhotos());
  }, [query]);

  useEffect(load, [load]);

  const now = Date.now();
  const searching = query.trim().length > 0;
  const today = todayKey(now);
  const hasToday = useMemo(
    () => entries.some((e) => e.dayKey === today),
    [entries, today],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.logo}>Inkwell</Text>
        <View style={styles.headerButtons}>
          <Pressable onPress={props.onCalendar} hitSlop={10} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Calendar</Text>
          </Pressable>
          <Pressable onPress={props.onSettings} hitSlop={10} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Settings</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search your journal…"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <FlatList
        data={entries}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searching
              ? 'No entries match that search.'
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  logo: { fontFamily: serif, fontSize: 26, color: colors.textPrimary },
  headerButtons: { flexDirection: 'row', gap: 16 },
  headerBtn: {},
  headerBtnText: { color: colors.ink, fontSize: 14 },
  search: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.textPrimary,
  },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
  dayHeader: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 6,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontFamily: serif,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardSnippet: { color: colors.textBody, fontSize: 13, lineHeight: 18, marginTop: 3 },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.hairline,
  },
  emptyText: {
    color: colors.textMuted,
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
    backgroundColor: colors.ink,
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 26,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
