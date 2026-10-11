// =============================================================================
// Event detail — note, tags, video (Phase 2 — FR-M3/M4 / AC-9 ; G-7 playback)
//
// - GET /events/:id → the logged fields READ-ONLY (the moat), shown as a
//   summary card in plain words; `note` and `tags` are editable and saved via
//   PATCH /events/:id.
// - Video: pick (expo-image-picker, mediaTypes:['videos']), validate the mime
//   against the G-6 allow-set, soft-warn >200MB, then presign → direct PUT →
//   POST /events/:id/media (lib/upload.ts) and refetch so it shows.
// - Playback: GET /media/:id/url → an expo-video <VideoView> with the
//   short-lived presigned URL.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import type { BehaviorEventWithMediaDTO, MediaDTO, Outcome } from '@tailsup/shared';
import { colors, fontFallback, fonts, radii } from '../../../lib/theme';
import { useLang } from '../../../lib/i18n';
import { ApiError, getEvent, getMediaPlaybackUrl, patchEvent } from '../../../lib/api';
import { OUTCOME_LABELS, formatDay, formatTime, intensityWord, triggerLabel } from '../../../lib/labels';
import {
  ALLOWED_VIDEO_TYPES,
  SOFT_SIZE_WARN_BYTES,
  isAllowedVideoType,
  uploadVideo,
  type PickedVideo,
} from '../../../lib/upload';
import {
  Button,
  ErrorState,
  IconButton,
  LoadingState,
  Muted,
  Notice,
  Panel,
  Pill,
  Screen,
  SectionHeader,
  Title,
  type PillTone,
} from '../../../components/app/AppKit';
import { IconBack, IconPlus, IconVideo } from '../../../components/app/AppIcons';

const copy = {
  el: {
    back: 'Πίσω',
    title: 'Καταγραφή',
    loading: 'Φόρτωση…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    trigger: 'Ερέθισμα',
    distance: 'Απόσταση',
    intensity: 'Ένταση',
    intervention: 'Παρέμβαση',
    note: 'Σημείωση',
    notePlaceholder: 'Τι παρατηρήσατε; π.χ. κοντά στην πύλη του πάρκου',
    tags: 'Ετικέτες',
    noTags: 'Καμία ετικέτα ακόμα.',
    tagPlaceholder: 'Νέα ετικέτα',
    add: 'Προσθήκη',
    remove: (t: string) => `Αφαίρεση ετικέτας ${t}`,
    save: 'Αποθήκευση',
    saved: '✓ Αποθηκεύτηκε.',
    video: 'Βίντεο',
    noVideo: 'Δεν υπάρχει βίντεο ακόμα.',
    upload: 'Προσθήκη βίντεο',
    uploading: 'Ανέβασμα…',
    play: 'Αναπαραγωγή',
    loadingVideo: 'Φόρτωση βίντεο…',
    permission: 'Δεν δόθηκε άδεια πρόσβασης στα βίντεο.',
    unsupported: (t: string | null) =>
      `Μη υποστηριζόμενη μορφή${t ? ` (${t})` : ''}. Επιτρέπονται: ${ALLOWED_VIDEO_TYPES.join(', ')}.`,
    largeTitle: 'Μεγάλο βίντεο',
    largeBody: 'Το βίντεο ξεπερνά τα 200 MB και μπορεί να αργήσει να ανέβει από δίκτυο κινητού.',
    playbackFailed: 'Δεν φορτώθηκε το βίντεο. Δοκιμάστε ξανά.',
    uploadFailed: 'Το ανέβασμα απέτυχε.',
  },
  en: {
    back: 'Back',
    title: 'Logged event',
    loading: 'Loading…',
    errorTitle: 'Could not load',
    retry: 'Try again',
    trigger: 'Trigger',
    distance: 'Distance',
    intensity: 'Intensity',
    intervention: 'Intervention',
    note: 'Note',
    notePlaceholder: 'What did you notice? e.g. near the park gate',
    tags: 'Tags',
    noTags: 'No tags yet.',
    tagPlaceholder: 'New tag',
    add: 'Add',
    remove: (t: string) => `Remove tag ${t}`,
    save: 'Save',
    saved: '✓ Saved.',
    video: 'Video',
    noVideo: 'No video yet.',
    upload: 'Add a video',
    uploading: 'Uploading…',
    play: 'Play',
    loadingVideo: 'Loading video…',
    permission: 'Media library permission denied.',
    unsupported: (t: string | null) => `Unsupported type${t ? ` (${t})` : ''}. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}.`,
    largeTitle: 'Large video',
    largeBody: 'This video is over 200 MB and may take a while to upload on a phone network.',
    playbackFailed: 'Could not load the video. Please try again.',
    uploadFailed: 'Upload failed.',
  },
} as const;

const OUTCOME_TONE: Record<Outcome, PillTone> = {
  disengaged: 'mint',
  recovered_slowly: 'peach',
  over_threshold: 'coral',
};

type Status =
  | { kind: 'loading' }
  | { kind: 'success'; event: BehaviorEventWithMediaDTO }
  | { kind: 'error'; message: string };

type Upload = { kind: 'idle' } | { kind: 'uploading'; progress: number } | { kind: 'error'; message: string };

const webCursor = Platform.select({ web: { cursor: 'pointer' } as object, default: {} });

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, fontFallback.body]}>{label}</Text>
      <Text style={[styles.factValue, fontFallback.body]}>{value}</Text>
    </View>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const c = copy[lang];

  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<{ kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string }>({
    kind: 'idle',
  });
  const [upload, setUpload] = useState<Upload>({ kind: 'idle' });
  const [playingMediaId, setPlayingMediaId] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const event = await getEvent(id);
      setStatus({ kind: 'success', event });
      setNote(event.note ?? '');
      setTags(event.tags ?? []);
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setSaveState({ kind: 'idle' });
    try {
      const updated = await patchEvent(id, {
        note: note.trim() === '' ? null : note,
        tags: tags.length === 0 ? null : tags,
      });
      setStatus((s) => (s.kind === 'success' ? { kind: 'success', event: { ...s.event, ...updated } } : s));
      setSaveState({ kind: 'saved' });
    } catch (err) {
      setSaveState({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }, [id, note, tags]);

  const addTag = useCallback(() => {
    const t = tagDraft.trim();
    if (t === '') return;
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTagDraft('');
  }, [tagDraft]);

  const onPickAndUpload = useCallback(async () => {
    setUpload({ kind: 'idle' });
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setUpload({ kind: 'error', message: c.permission });
      return;
    }
    // SDK 54: mediaTypes is a STRING ARRAY (['videos']), not MediaTypeOptions.
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (picked.canceled || picked.assets.length === 0) return;

    const asset = picked.assets[0];
    const mimeType = asset.mimeType ?? null;
    // Validate against the G-6 allow-set BEFORE presigning.
    if (!isAllowedVideoType(mimeType)) {
      setUpload({ kind: 'error', message: c.unsupported(mimeType) });
      return;
    }
    // Soft-warn above 200 MB (G-6) — do not block.
    if (asset.fileSize != null && asset.fileSize > SOFT_SIZE_WARN_BYTES && Platform.OS !== 'web') {
      Alert.alert(c.largeTitle, c.largeBody);
    }
    const pickedVideo: PickedVideo = {
      uri: asset.uri,
      contentType: mimeType,
      file: (asset as { file?: Blob | null }).file ?? null,
    };
    setUpload({ kind: 'uploading', progress: 0 });
    try {
      await uploadVideo(id, pickedVideo, (fraction) => setUpload({ kind: 'uploading', progress: fraction }));
      setUpload({ kind: 'idle' });
      await load();
    } catch (err) {
      setUpload({ kind: 'error', message: err instanceof ApiError ? err.message : c.uploadFailed });
    }
  }, [id, load, c]);

  const onPlay = useCallback(
    async (media: MediaDTO) => {
      setPlayingMediaId(media.id);
      setPlaybackUrl(null);
      try {
        const { url } = await getMediaPlaybackUrl(media.id);
        setPlaybackUrl(url);
      } catch {
        setPlayingMediaId(null);
        Alert.alert(c.video, c.playbackFailed);
      }
    },
    [c],
  );

  const back = (
    <IconButton
      icon={<IconBack color={colors.primarySoft} />}
      accessibilityLabel={c.back}
      tone="outline"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/dogs'))}
    />
  );

  if (status.kind === 'loading') {
    return (
      <Screen maxWidth={640}>
        {back}
        <LoadingState label={c.loading} />
      </Screen>
    );
  }
  if (status.kind === 'error') {
    return (
      <Screen maxWidth={640}>
        {back}
        <ErrorState title={c.errorTitle} message={status.message} retryLabel={c.retry} onRetry={() => void load()} />
      </Screen>
    );
  }

  const e = status.event;
  const unit = lang === 'el' ? 'μέτρα' : 'metres';

  return (
    <Screen maxWidth={640}>
      <View style={styles.header}>
        {back}
        <View style={styles.headerText}>
          <Title>{c.title}</Title>
          <Muted>
            {formatDay(e.occurredAt, lang)} · {formatTime(e.occurredAt, lang)}
          </Muted>
        </View>
      </View>

      <Panel style={styles.summary}>
        <Pill label={OUTCOME_LABELS[lang][e.outcome]} tone={OUTCOME_TONE[e.outcome]} />
        <View style={styles.facts}>
          <Fact label={c.trigger} value={triggerLabel(e.triggerType, e.triggerDetail, lang)} />
          <Fact label={c.distance} value={`${e.thresholdMeters} ${unit}`} />
          <Fact label={c.intensity} value={`${e.intensity}/10 · ${intensityWord(e.intensity, lang)}`} />
          <Fact label={c.intervention} value={e.intervention} />
        </View>
      </Panel>

      <View style={styles.section}>
        <SectionHeader title={c.note} />
        <TextInput
          style={[styles.input, styles.noteInput, fontFallback.body]}
          multiline
          placeholder={c.notePlaceholder}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={c.note}
          value={note}
          onChangeText={setNote}
          editable={!saving}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={c.tags} />
        <View style={styles.tagRow}>
          {tags.length === 0 && <Muted>{c.noTags}</Muted>}
          {tags.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={c.remove(t)}
              onPress={() => setTags((prev) => prev.filter((x) => x !== t))}
              style={({ hovered }) => [styles.tag, hovered && { backgroundColor: colors.mint }, webCursor]}
            >
              <Text style={[styles.tagText, fontFallback.body]}>{t}  ✕</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tagAdd}>
          <TextInput
            style={[styles.input, styles.tagInput, fontFallback.body]}
            placeholder={c.tagPlaceholder}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={c.tagPlaceholder}
            value={tagDraft}
            onChangeText={setTagDraft}
            onSubmitEditing={addTag}
            autoCapitalize="none"
            editable={!saving}
          />
          <Button label={c.add} variant="secondary" onPress={addTag} icon={<IconPlus size={16} color={colors.primarySoft} />} />
        </View>
      </View>

      <View style={styles.saveRow}>
        <Button label={c.save} variant="green" loading={saving} onPress={() => void onSave()} />
        {saveState.kind === 'saved' && <Muted>{c.saved}</Muted>}
      </View>
      {saveState.kind === 'error' && <Notice tone="error">{saveState.message}</Notice>}

      <View style={styles.section}>
        <SectionHeader title={c.video} />
        {e.media.length === 0 && <Muted>{c.noVideo}</Muted>}
        {e.media.map((m) => (
          <Panel key={m.id} style={styles.media}>
            <View style={styles.mediaHead}>
              <IconVideo color={colors.primary} />
              <Text style={[styles.mediaTitle, fontFallback.body]}>
                {formatDay(m.uploadedAt, lang)} · {formatTime(m.uploadedAt, lang)}
              </Text>
            </View>
            {playingMediaId === m.id ? (
              playbackUrl ? (
                <VideoPlayerView url={playbackUrl} />
              ) : (
                <View style={styles.playerLoading}>
                  <ActivityIndicator color={colors.primary} />
                  <Muted>{c.loadingVideo}</Muted>
                </View>
              )
            ) : (
              <Button label={`▶  ${c.play}`} variant="secondary" onPress={() => void onPlay(m)} />
            )}
          </Panel>
        ))}
        <Button
          label={upload.kind === 'uploading' ? c.uploading : c.upload}
          variant="secondary"
          disabled={upload.kind === 'uploading'}
          onPress={() => void onPickAndUpload()}
          icon={<IconVideo size={18} color={colors.primarySoft} />}
        />
        {upload.kind === 'uploading' && (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(upload.progress * 100)}%` }]} />
            </View>
            <Muted>{Math.round(upload.progress * 100)}%</Muted>
          </View>
        )}
        {upload.kind === 'error' && <Notice tone="error">{upload.message}</Notice>}
      </View>
    </Screen>
  );
}

// An isolated player so the expo-video hook is scoped to the active URL and
// recreated when the (re-requested-on-expiry) URL changes.
function VideoPlayerView({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p: VideoPlayer) => {
    p.loop = false;
  });
  return <VideoView player={player} style={styles.video} allowsFullscreen contentFit="contain" />;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1, gap: 2 },
  summary: { gap: 14 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  fact: { width: '50%', gap: 2, paddingRight: 12 },
  factLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted },
  factValue: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  section: { gap: 10 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  noteInput: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: radii.pill, backgroundColor: colors.mintSoft, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36 },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textOnMint },
  tagAdd: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  tagInput: { flex: 1 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  media: { gap: 12 },
  mediaHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mediaTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  playerLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  video: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: '#000' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 10, borderRadius: radii.pill, backgroundColor: '#F3ECDF', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radii.pill },
});
