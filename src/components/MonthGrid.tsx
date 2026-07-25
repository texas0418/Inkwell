// src/components/MonthGrid.tsx
// Plain month grid (weeks start Sunday). Days with entries get an ink dot;
// no dependency — it's ~a screen of layout math. Themed via useTheme().

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayKeyFromDate, todayKey } from '../models';
import { Palette, useTheme } from '../theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function MonthGrid(props: {
  year: number;
  month0: number;
  counts: Record<string, number>;
  selected: string | null;
  onSelectDay: (dayKey: string) => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { year, month0 } = props;
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const leading = first.getDay(); // 0 = Sunday
  const today = todayKey(Date.now());

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      dayKeyFromDate(new Date(year, month0, i + 1)),
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.grid}>
      <View style={styles.week}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((key, di) => {
            if (!key) return <View key={di} style={styles.cell} />;
            const isSelected = key === props.selected;
            const isToday = key === today;
            const hasEntries = (props.counts[key] ?? 0) > 0;
            return (
              <Pressable
                key={di}
                style={styles.cell}
                onPress={() => props.onSelectDay(key)}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isToday && styles.todayCircle,
                    isSelected && styles.selectedCircle,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isToday && styles.todayText,
                      isSelected && styles.selectedText,
                    ]}
                  >
                    {parseInt(key.slice(8), 10)}
                  </Text>
                </View>
                <View style={[styles.dot, hasEntries && styles.dotOn]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    grid: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 6,
    },
    week: { flexDirection: 'row' },
    weekday: {
      flex: 1,
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 4,
    },
    cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
    dayCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    todayCircle: { borderWidth: 1, borderColor: c.accentBorder },
    selectedCircle: { backgroundColor: c.accent },
    dayText: { color: c.textBody, fontSize: 14 },
    todayText: { color: c.accent, fontWeight: '600' },
    selectedText: { color: c.accentText, fontWeight: '600' },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      marginTop: 1,
      backgroundColor: 'transparent',
    },
    dotOn: { backgroundColor: c.accent },
  });
