// src/screens/EditorScreen.tsx
// Write or edit one entry. Back = save (a journal never loses writing);
// a brand-new entry that is still completely empty is simply not created.
// Date & time are editable (tap the header date). Photos and drawings share
// one attachment row and one limit: free tier = one per entry, Pro = unlimited
// (fail-open in dev).

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {
  countEntries,
  deleteEntry,
  deletePhoto,
  getEntry,
  insertEntry,
  insertPhoto,
  listPhotosForEntry,
  updateEntry,
} from '../db';
import { maybeAskForReview } from '../review';
import {
  MOODS,
  Mood,
  countWords,
  extractUrls,
  formatClock,
  formatDayLabel,
  linkHref,
  promptForDay,
} from '../models';
import { deletePhotoFile, importPhotoFile, photoUri } from '../photos';
import { useProAccess, purchasePro } from '../proAccess';
import { Palette, ThemeFonts, useTheme } from '../theme';
import DateTimeSheet from '../components/DateTimeSheet';
import DrawingSheet from '../components/DrawingSheet';

interface PhotoDraft {
  rowId?: number; // set once persisted
  fileName: string;
  width: number;
  height: number;
}

// eslint-disable-next-line max-lines-per-function, complexity -- tech-debt #3
export default function EditorScreen(props: {
  entryId: number | null;
  dayKey: string;
  onDone: () => void;
}) {
  const pro = useProAccess();
  const { colors: c, fonts, statusBarStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c, fonts), [c, fonts]);
  const [entryId] = useState<number | null>(props.entryId);
  const [dayKey, setDayKey] = useState(props.dayKey);
  const [createdAtMs, setCreatedAtMs] = useState<number>(() => Date.now());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [pinned, setPinned] = useState(false);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [loaded, setLoaded] = useState(props.entryId == null);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);

  useEffect(() => {
    if (props.entryId == null) return;
    const e = getEntry(props.entryId);
    if (e) {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tech-debt #4
      setTitle(e.title);
      setBody(e.body);
      setMood(e.mood);
      setPinned(e.pinned);
      setDayKey(e.dayKey);
      setCreatedAtMs(e.createdAtMs);
      setPhotos(
        listPhotosForEntry(props.entryId).map((p) => ({
          rowId: p.id,
          fileName: p.fileName,
          width: p.width,
          height: p.height,
        })),
      );
    }
    setLoaded(true);
  }, [props.entryId]);

  const isEmpty =
    title.trim() === '' && body.trim() === '' && photos.length === 0 && mood == null;

  const words = countWords(body) + countWords(title);
  const urls = useMemo(() => extractUrls(body), [body]);
  const prompt = useMemo(() => promptForDay(dayKey), [dayKey]);
  const showPrompt = entryId == null && title === '' && body === '';

  const saveAndClose = () => {
    const now = Date.now();
    if (entryId == null) {
      if (!isEmpty) {
        const id = insertEntry({
          dayKey,
          createdAtMs,
          updatedAtMs: now,
          title: title.trim(),
          body,
          mood,
          pinned,
        });
        photos.forEach((p, i) =>
          insertPhoto(id, {
            fileName: p.fileName,
            position: i,
            width: p.width,
            height: p.height,
          }),
        );
        // After the entry is safely saved: one-time review ask at 5+ entries.
        maybeAskForReview({ totalEntries: countEntries() });
      }
    } else {
      updateEntry({
        id: entryId,
        dayKey,
        createdAtMs,
        updatedAtMs: now,
        title: title.trim(),
        body,
        mood,
        pinned,
      });
    }
    props.onDone();
  };

  const confirmDelete = () => {
    Alert.alert('Delete entry?', 'This removes the entry and its photos from your journal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          for (const p of photos) await deletePhotoFile(p.fileName);
          if (entryId != null) deleteEntry(entryId);
          props.onDone();
        },
      },
    ]);
  };

  const showPaywall = () => {
    Alert.alert(
      'Inkwell Pro',
      'Free includes one photo or drawing per entry. Unlock Pro once — $9.99, no subscription, ever — for unlimited attachments.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Unlock Pro',
          onPress: async () => {
            try {
              await purchasePro();
            } catch (e: any) {
              if (!e?.userCancelled) {
                Alert.alert('Purchase failed', e?.message ?? 'Please try again later.');
              }
            }
          },
        },
      ],
    );
  };

  const attachmentRoomLeft = (): boolean => {
    if (!pro && photos.length >= 1) {
      showPaywall();
      return false;
    }
    return true;
  };

  /** Copy a picked/drawn file in and register the draft (and row if saved). */
  const addAttachment = async (srcUri: string, w: number, h: number) => {
    try {
      const fileName = await importPhotoFile(srcUri);
      const draft: PhotoDraft = { fileName, width: w, height: h };
      if (entryId != null) {
        draft.rowId = insertPhoto(entryId, {
          fileName,
          position: photos.length,
          width: w,
          height: h,
        });
      }
      setPhotos((prev) => [...prev, draft]);
    } catch (e) {
      console.warn('attachment import failed', e);
    }
  };

  const addPhotos = async () => {
    if (!attachmentRoomLeft()) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photos permission needed',
        'Allow photo access in Settings to attach photos. They are copied into Inkwell and never leave your device.',
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: pro,
    });
    if (res.canceled || !res.assets?.length) return;
    const room = pro ? res.assets.length : Math.max(0, 1 - photos.length);
    for (const a of res.assets.slice(0, room)) {
      await addAttachment(a.uri, a.width ?? 0, a.height ?? 0);
    }
  };

  const removePhoto = (draft: PhotoDraft) => {
    Alert.alert('Remove this attachment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (draft.rowId != null) deletePhoto(draft.rowId);
          await deletePhotoFile(draft.fileName);
          setPhotos((prev) => prev.filter((p) => p.fileName !== draft.fileName));
        },
      },
    ]);
  };

  if (!loaded) return <View style={styles.root} />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={statusBarStyle} />
      <View style={styles.header}>
        <Pressable onPress={saveAndClose} hitSlop={12}>
          <Text style={styles.backText}>‹ Done</Text>
        </Pressable>
        <Pressable onPress={() => setShowDateSheet(true)} hitSlop={8}>
          <Text style={styles.headerTitle}>
            {formatDayLabel(dayKey, Date.now())} · {formatClock(createdAtMs)}{' '}
            <Text style={styles.headerEdit}>✎</Text>
          </Text>
        </Pressable>
        <Pressable onPress={() => setPinned((p) => !p)} hitSlop={12}>
          <Text style={[styles.star, pinned && styles.starOn]}>{pinned ? '★' : '☆'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={styles.titleInput}
          placeholder="Title (optional)"
          placeholderTextColor={c.textMuted}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
        />

        <View style={styles.moodRow}>
          {MOODS.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMood(mood === m.key ? null : m.key)}
              style={[styles.moodChip, mood === m.key && styles.moodChipActive]}
              hitSlop={4}
            >
              <Text style={[styles.moodEmoji, mood !== m.key && mood != null && styles.moodDim]}>
                {m.emoji}
              </Text>
            </Pressable>
          ))}
        </View>

        {showPrompt && (
          <Pressable style={styles.promptCard} onPress={() => setTitle(prompt)}>
            <Text style={styles.promptLabel}>Today&apos;s prompt — tap to use</Text>
            <Text style={styles.promptText}>{prompt}</Text>
          </Pressable>
        )}

        <TextInput
          style={styles.bodyInput}
          placeholder="Write about your day…"
          placeholderTextColor={c.textMuted}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
        />
        {words > 0 && <Text style={styles.wordCount}>{words} {words === 1 ? 'word' : 'words'}</Text>}

        {urls.length > 0 && (
          <View style={styles.linkRow}>
            {urls.map((u) => (
              <Pressable
                key={u}
                style={styles.linkChip}
                onPress={() =>
                  Linking.openURL(linkHref(u)).catch(() =>
                    Alert.alert('Could not open link', u),
                  )
                }
              >
                <Text style={styles.linkText} numberOfLines={1}>
                  ↗ {u.replace(/^https?:\/\//i, '')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.photoRow}>
          {photos.map((p) => (
            <Pressable key={p.fileName} onLongPress={() => removePhoto(p)}>
              <Image source={{ uri: photoUri(p.fileName) }} style={styles.photo} />
              <Pressable style={styles.photoX} onPress={() => removePhoto(p)} hitSlop={8}>
                <Text style={styles.photoXText}>✕</Text>
              </Pressable>
            </Pressable>
          ))}
          <Pressable style={styles.addPhoto} onPress={addPhotos}>
            <Text style={styles.addPhotoText}>＋</Text>
            <Text style={styles.addPhotoLabel}>Photo</Text>
          </Pressable>
          <Pressable
            style={styles.addPhoto}
            onPress={() => {
              if (attachmentRoomLeft()) setShowDrawing(true);
            }}
          >
            <Text style={styles.addPhotoText}>✎</Text>
            <Text style={styles.addPhotoLabel}>Draw</Text>
          </Pressable>
        </View>
        {!pro && photos.length >= 1 && (
          <Text style={styles.proHint}>More attachments per entry is a Pro feature.</Text>
        )}

        {entryId != null && (
          <Pressable onPress={confirmDelete} style={styles.deleteRow} hitSlop={8}>
            <Text style={styles.deleteText}>Delete entry</Text>
          </Pressable>
        )}
      </ScrollView>

      {showDateSheet && (
        <DateTimeSheet
          dayKey={dayKey}
          timeMs={createdAtMs}
          onClose={() => setShowDateSheet(false)}
          onSave={(k, ms) => {
            setDayKey(k);
            setCreatedAtMs(ms);
            setShowDateSheet(false);
          }}
        />
      )}
      {showDrawing && (
        <DrawingSheet
          onClose={() => setShowDrawing(false)}
          onDone={async (uri) => {
            setShowDrawing(false);
            await addAttachment(uri, 0, 0);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette, f: ThemeFonts) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backText: { color: c.accent, fontSize: 15 },
    headerTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
    headerEdit: { color: c.accent, fontSize: 12 },
    star: { color: c.textMuted, fontSize: 22, width: 28, textAlign: 'right' },
    starOn: { color: c.proGold },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 20, paddingBottom: 48 },
    titleInput: {
      fontFamily: f.title,
      fontSize: 22,
      color: c.textPrimary,
      paddingVertical: 8,
    },
    moodRow: { flexDirection: 'row', gap: 10, marginTop: 2, marginBottom: 10 },
    moodChip: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    moodChipActive: { borderColor: c.accent, backgroundColor: c.accentSoft },
    moodEmoji: { fontSize: 20 },
    moodDim: { opacity: 0.45 },
    promptCard: {
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accentBorder,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    promptLabel: {
      color: c.accent,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 3,
    },
    promptText: { color: c.textBody, fontSize: 13, fontStyle: 'italic' },
    bodyInput: {
      fontFamily: f.body,
      minHeight: 200,
      fontSize: 16,
      lineHeight: 24,
      color: c.textBody,
      paddingVertical: 6,
    },
    wordCount: {
      color: c.textMuted,
      fontSize: 11,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    linkChip: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.accentBorder,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 12,
      maxWidth: '100%',
    },
    linkText: { color: c.accent, fontSize: 13 },
    photoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 16,
    },
    photo: {
      width: 88,
      height: 88,
      borderRadius: 10,
      backgroundColor: c.hairline,
    },
    photoX: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.textPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoXText: { color: c.bg, fontSize: 11, fontWeight: '700' },
    addPhoto: {
      width: 88,
      height: 88,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.accentBorder,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.card,
    },
    addPhotoText: { color: c.accent, fontSize: 22, lineHeight: 26 },
    addPhotoLabel: { color: c.accent, fontSize: 12, marginTop: 2 },
    proHint: { color: c.textMuted, fontSize: 12, marginTop: 10 },
    deleteRow: { marginTop: 28, alignItems: 'center' },
    deleteText: { color: c.danger, fontSize: 14, fontWeight: '600' },
  });
