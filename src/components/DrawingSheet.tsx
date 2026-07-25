// src/components/DrawingSheet.tsx
// Sketch on paper: PanResponder captures strokes, react-native-svg renders
// them, react-native-view-shot rasterizes the canvas to a PNG. The caller
// stores the result as a regular photo attachment — thumbnails, backups and
// the photo limit all keep working with zero extra plumbing.

import React, { useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { Palette, useTheme } from '../theme';

interface Stroke {
  points: string; // "x,y x,y …"
  color: string;
  width: number;
}

const PEN_WIDTHS = [3, 7];

// Eight journal inks on a fixed paper ground, so drawings look the same
// whatever theme they were made (or are later viewed) in.
const PEN_COLORS = [
  '#33567f', // fountain blue (default)
  '#2f6b6d', // teal
  '#3f6f4e', // forest
  '#a8842c', // gold
  '#a85a4b', // rust
  '#6d4a72', // plum
  '#4c463b', // graphite
  '#1c1a17', // ink black
];

export default function DrawingSheet(props: {
  onDone: (fileUri: string) => void;
  onClose: () => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [width, setWidth] = useState(PEN_WIDTHS[0]);
  const canvasRef = useRef<View>(null);
  const liveStroke = useRef<Stroke | null>(null);
  const penState = useRef({ color: PEN_COLORS[0], width: PEN_WIDTHS[0] });
  penState.current = { color, width };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          liveStroke.current = {
            points: `${locationX.toFixed(1)},${locationY.toFixed(1)}`,
            color: penState.current.color,
            width: penState.current.width,
          };
          setCurrent(liveStroke.current);
        },
        onPanResponderMove: (evt) => {
          const s = liveStroke.current;
          if (!s) return;
          const { locationX, locationY } = evt.nativeEvent;
          liveStroke.current = {
            ...s,
            points: `${s.points} ${locationX.toFixed(1)},${locationY.toFixed(1)}`,
          };
          setCurrent(liveStroke.current);
        },
        onPanResponderRelease: () => {
          const s = liveStroke.current;
          liveStroke.current = null;
          setCurrent(null);
          if (s && s.points.includes(' ')) setStrokes((prev) => [...prev, s]);
        },
      }),
    [],
  );

  const save = async () => {
    if (!strokes.length) {
      props.onClose();
      return;
    }
    const uri = await captureRef(canvasRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
    props.onDone(uri);
  };

  const all = current ? [...strokes, current] : strokes;

  return (
    <Modal animationType="slide" onRequestClose={props.onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={props.onClose} hitSlop={12}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Drawing</Text>
          <Pressable onPress={save} hitSlop={12}>
            <Text style={styles.saveText}>{strokes.length ? 'Add' : 'Close'}</Text>
          </Pressable>
        </View>

        <View
          ref={canvasRef}
          collapsable={false}
          style={styles.canvas}
          {...pan.panHandlers}
        >
          <Svg style={StyleSheet.absoluteFill}>
            {all.map((s, i) => (
              <Polyline
                key={i}
                points={s.points}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.colorRow}>
            {PEN_COLORS.map((pc) => (
              <Pressable
                key={pc}
                onPress={() => setColor(pc)}
                style={[
                  styles.colorDot,
                  { backgroundColor: pc },
                  color === pc && styles.colorDotOn,
                ]}
                hitSlop={6}
              />
            ))}
          </View>
          <View style={styles.toolsRow}>
            <View style={styles.tools}>
              {PEN_WIDTHS.map((w) => (
                <Pressable
                  key={w}
                  onPress={() => setWidth(w)}
                  style={[styles.widthBtn, width === w && styles.widthBtnOn]}
                  hitSlop={6}
                >
                  <View style={[styles.widthPreview, { height: w, width: 22 }]} />
                </Pressable>
              ))}
            </View>
            <View style={styles.tools}>
              <Pressable
                onPress={() => setStrokes((p) => p.slice(0, -1))}
                disabled={!strokes.length}
                hitSlop={8}
              >
                <Text style={[styles.toolText, !strokes.length && styles.toolDisabled]}>
                  Undo
                </Text>
              </Pressable>
              <Pressable onPress={() => setStrokes([])} disabled={!strokes.length} hitSlop={8}>
                <Text style={[styles.toolText, !strokes.length && styles.toolDisabled]}>
                  Clear
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const PAPER = '#fbf7ee'; // fixed drawing ground, theme-independent

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cancelText: { color: c.textMuted, fontSize: 15 },
    title: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
    saveText: { color: c.accent, fontSize: 15, fontWeight: '600' },
    canvas: {
      flex: 1,
      marginHorizontal: 16,
      borderRadius: 14,
      backgroundColor: PAPER,
      borderWidth: 1,
      borderColor: c.cardBorder,
      overflow: 'hidden',
    },
    toolbar: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      paddingBottom: 34,
      gap: 14,
    },
    colorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toolsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tools: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    colorDot: { width: 28, height: 28, borderRadius: 14 },
    colorDotOn: {
      borderWidth: 3,
      borderColor: c.textPrimary,
      transform: [{ scale: 1.15 }],
    },
    widthBtn: {
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    widthBtnOn: { backgroundColor: c.accentSoft },
    widthPreview: { backgroundColor: c.textBody, borderRadius: 4 },
    toolText: { color: c.accent, fontSize: 14 },
    toolDisabled: { opacity: 0.35 },
  });
