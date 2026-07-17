// src/screens/EditorScreen.tsx
// Write or edit one entry. Back = save (a journal never loses writing);
// a brand-new entry that is still completely empty is simply not created.
// Photos: free tier = one per entry; Pro = unlimited (fail-open in dev).

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
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
  deleteEntry,
  deletePhoto,
  getEntry,
  insertEntry,
  insertPhoto,
  listPhotosForEntry,
  updateEntry,
} from '../db';
import { MOODS, Mood, formatDayLabel } from '../models';
import { deletePhotoFile, importPhotoFile, photoUri } from '../photos';
import { useProAccess, purchasePro } from '../proAccess';
import { colors, serif } from '../theme';

interface PhotoDraft {
  rowId?: number; // set once persisted
  fileName: string;
  width: number;
  height: number;
}

export default function EditorScreen(props: {
  entryId: number | null;
  dayKey: string;
  onDone: () => void;
}) {
  const pro = useProAccess();
  const [entryId, setEntryId] = useState<number | null>(props.entryId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [loaded, setLoaded] = useState(props.entryId == null);

  useEffect(() => {
    if (props.entryId == null) return;
    const e = getEntry(props.entryId);
    if (e) {
      setTitle(e.title);
      setBody(e.body);
      setMood(e.mood);
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

  const saveAndClose = () => {
    const now = Date.now();
    if (entryId == null) {
      if (!isEmpty) {
        const id = insertEntry({
          dayKey: props.dayKey,
          createdAtMs: now,
          updatedAtMs: now,
          title: title.trim(),
          body,
          mood,
        });
        photos.forEach((p, i) =>
          insertPhoto(id, {
            fileName: p.fileName,
            position: i,
            width: p.width,
            height: p.height,
          }),
        );
      }
    } else {
      updateEntry({
        id: entryId,
        dayKey: props.dayKey,
        createdAtMs: 0, // not part of UPDATE
        updatedAtMs: now,
        title: title.trim(),
        body,
        mood,
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
      'Free includes one photo per entry. Unlock Pro once — no subscription, ever — for unlimited photos.',
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

  const addPhotos = async () => {
    if (!pro && photos.length >= 1) {
      showPaywall();
      return;
    }
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
    const picked = res.assets.slice(0, room);
    const drafts: PhotoDraft[] = [];
    for (const a of picked) {
      try {
        const fileName = await importPhotoFile(a.uri);
        drafts.push({ fileName, width: a.width ?? 0, height: a.height ?? 0 });
      } catch (e) {
        console.warn('photo import failed', e);
      }
    }
    if (!drafts.length) return;

    if (entryId != null) {
      // Entry exists: persist rows immediately so nothing dangles.
      const base = photos.length;
      drafts.forEach((d, i) => {
        d.rowId = insertPhoto(entryId, {
          fileName: d.fileName,
          position: base + i,
          width: d.width,
          height: d.height,
        });
      });
    }
    setPhotos((prev) => [...prev, ...drafts]);
  };

  const removePhoto = (draft: PhotoDraft) => {
    Alert.alert('Remove photo?', undefined, [
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
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={saveAndClose} hitSlop={12}>
          <Text style={styles.backText}>‹ Done</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{formatDayLabel(props.dayKey, Date.now())}</Text>
        {entryId != null ? (
          <Pressable onPress={confirmDelete} hitSlop={12}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={styles.titleInput}
          placeholder="Title (optional)"
          placeholderTextColor={colors.textMuted}
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

        <TextInput
          style={styles.bodyInput}
          placeholder="Write about your day…"
          placeholderTextColor={colors.textMuted}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
        />

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
        </View>
        {!pro && photos.length >= 1 && (
          <Text style={styles.proHint}>More photos per entry is a Pro feature.</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backText: { color: colors.ink, fontSize: 15 },
  headerTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  deleteText: { color: colors.danger, fontSize: 14 },
  headerSpacer: { width: 50 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  titleInput: {
    fontFamily: serif,
    fontSize: 22,
    color: colors.textPrimary,
    paddingVertical: 8,
  },
  moodRow: { flexDirection: 'row', gap: 10, marginTop: 2, marginBottom: 10 },
  moodChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  moodChipActive: { borderColor: colors.ink, backgroundColor: colors.inkSoft },
  moodEmoji: { fontSize: 20 },
  moodDim: { opacity: 0.45 },
  bodyInput: {
    minHeight: 220,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
    paddingVertical: 6,
  },
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
    backgroundColor: colors.hairline,
  },
  photoX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoXText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inkBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  addPhotoText: { color: colors.ink, fontSize: 22, lineHeight: 26 },
  addPhotoLabel: { color: colors.ink, fontSize: 12, marginTop: 2 },
  proHint: { color: colors.textMuted, fontSize: 12, marginTop: 10 },
});
