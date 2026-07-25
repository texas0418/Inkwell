// src/components/DateTimeSheet.tsx
// Edit an entry's date and time without a native picker dependency:
// day chevrons + numeric hour/minute fields. Time is local, 24-hour entry.

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  dateFromDayKey,
  dayKeyFromDate,
  formatDayLabel,
  prevDayKey,
  todayKey,
} from '../models';
import { Palette, useTheme } from '../theme';

function nextDayKey(key: string): string {
  const d = dateFromDayKey(key);
  d.setDate(d.getDate() + 1);
  return dayKeyFromDate(d);
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

export default function DateTimeSheet(props: {
  dayKey: string;
  timeMs: number; // current createdAtMs
  onSave: (dayKey: string, createdAtMs: number) => void;
  onClose: () => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const initial = new Date(props.timeMs);
  const [dayKey, setDayKey] = useState(props.dayKey);
  const [hourText, setHourText] = useState(pad2(initial.getHours()));
  const [minText, setMinText] = useState(pad2(initial.getMinutes()));

  const save = () => {
    const h = Math.min(23, Math.max(0, parseInt(hourText, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(minText, 10) || 0));
    const base = dateFromDayKey(dayKey).getTime();
    props.onSave(dayKey, base + h * 3600_000 + m * 60_000);
  };

  const setNow = () => {
    const now = new Date();
    setDayKey(dayKeyFromDate(now));
    setHourText(pad2(now.getHours()));
    setMinText(pad2(now.getMinutes()));
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable style={styles.dimmer} onPress={props.onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Entry date &amp; time</Text>

          <View style={styles.dayRow}>
            <Pressable onPress={() => setDayKey(prevDayKey(dayKey))} hitSlop={12}>
              <Text style={styles.chev}>‹</Text>
            </Pressable>
            <Text style={styles.dayLabel}>{formatDayLabel(dayKey, Date.now())}</Text>
            <Pressable onPress={() => setDayKey(nextDayKey(dayKey))} hitSlop={12}>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          </View>

          <View style={styles.timeRow}>
            <TextInput
              style={styles.timeInput}
              value={hourText}
              onChangeText={(t) => setHourText(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
            <Text style={styles.colon}>:</Text>
            <TextInput
              style={styles.timeInput}
              value={minText}
              onChangeText={(t) => setMinText(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
            <Pressable onPress={setNow} hitSlop={8}>
              <Text style={styles.nowText}>Now</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>24-hour time · entries sort by this within a day</Text>

          <View style={styles.btnRow}>
            <Pressable style={styles.cancelBtn} onPress={props.onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveText}>Set</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    dimmer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: 28,
    },
    sheet: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 16,
      padding: 20,
    },
    title: { color: c.textPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 22,
      paddingVertical: 16,
    },
    chev: { color: c.textBody, fontSize: 26, paddingHorizontal: 10 },
    dayLabel: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '600',
      minWidth: 140,
      textAlign: 'center',
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    timeInput: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 10,
      width: 62,
      paddingVertical: 10,
      textAlign: 'center',
      fontSize: 20,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    colon: { color: c.textPrimary, fontSize: 20, fontWeight: '600' },
    nowText: { color: c.accent, fontSize: 14, marginLeft: 10 },
    hint: { color: c.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10 },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
    cancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.accentBorder,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    cancelText: { color: c.accent, fontSize: 15, fontWeight: '600' },
    saveBtn: {
      flex: 1,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    saveText: { color: c.accentText, fontSize: 15, fontWeight: '600' },
  });
