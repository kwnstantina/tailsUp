// =============================================================================
// Post-session event detail + video upload + playback (Phase 2, Unit C —
// FR-M3/M4 / AC-9 ; G-7 USER OVERRIDE: presigned-GET playback)
//
// - Load GET /events/:id -> show the four tap fields READ-ONLY (the moat), edit
//   `note` (multiline) + `tags` (add/remove chips), persist via PATCH /events/:id.
// - Pick a video (expo-image-picker, mediaTypes:['videos']), validate the mime
//   against the G-6 allow-set, soft-warn >200MB, then run the presign -> direct
//   PUT -> POST /events/:id/media flow (lib/upload.ts) and refetch so it shows.
// - Play an attached media item: GET /media/:id/url -> render an expo-video
//   <VideoView> with the short-lived presigned URL (re-request on expiry).
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import type { BehaviorEventWithMediaDTO, MediaDTO } from '@tailsup/shared';
import { ApiError, getEvent, getMediaPlaybackUrl, patchEvent } from '../../lib/api';
import {
  ALLOWED_VIDEO_TYPES,
  SOFT_SIZE_WARN_BYTES,
  isAllowedVideoType,
  uploadVideo,
  type PickedVideo,
} from '../../lib/upload';

type Status =
  | { kind: 'loading' }
  | { kind: 'success'; event: BehaviorEventWithMediaDTO }
  | { kind: 'error'; message: string };

type Upload =
  | { kind: 'idle' }
  | { kind: 'uploading'; progress: number }
  | { kind: 'error'; message: string };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
      setStatus({
        kind: 'error',
        message: err instanceof ApiError ? err.message : 'Could not load the event.',
      });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── note/tags persistence ──────────────────────────────────────────────────
  const onSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patchEvent(id, {
        note: note.trim() === '' ? null : note,
        tags: tags.length === 0 ? null : tags,
      });
      // Reflect the saved server state into the loaded event.
      setStatus((s) =>
        s.kind === 'success' ? { kind: 'success', event: { ...s.event, ...updated } } : s,
      );
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save changes.');
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

  const removeTag = useCallback((t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  }, []);

  // ── pick + upload video ─────────────────────────────────────────────────────
  const onPickAndUpload = useCallback(async () => {
    setUpload({ kind: 'idle' });

    // Permission (no-op on web).
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setUpload({ kind: 'error', message: 'Media library permission denied.' });
      return;
    }

    // SDK 54: mediaTypes is a STRING ARRAY (['videos']), not MediaTypeOptions.
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (picked.canceled || picked.assets.length === 0) return;

    const asset = picked.assets[0];
    const mimeType = asset.mimeType ?? null;

    // Validate against the G-6 allow-set BEFORE presigning (R-6 thread starts here).
    if (!isAllowedVideoType(mimeType)) {
      setUpload({
        kind: 'error',
        message: `Unsupported type${mimeType ? ` (${mimeType})` : ''}. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}.`,
      });
      return;
    }

    // Soft-warn above 200 MB (G-6) — do not block.
    if (asset.fileSize != null && asset.fileSize > SOFT_SIZE_WARN_BYTES && Platform.OS !== 'web') {
      Alert.alert(
        'Large video',
        'This video is over 200 MB and may take a while to upload on a phone network.',
      );
    }

    const pickedVideo: PickedVideo = {
      uri: asset.uri,
      contentType: mimeType,
      file: (asset as { file?: Blob | null }).file ?? null,
    };

    setUpload({ kind: 'uploading', progress: 0 });
    try {
      await uploadVideo(id, pickedVideo, (fraction) =>
        setUpload({ kind: 'uploading', progress: fraction }),
      );
      setUpload({ kind: 'idle' });
      await load(); // refetch so the new media shows (FR-M4)
    } catch (err) {
      setUpload({
        kind: 'error',
        message: err instanceof ApiError ? err.message : 'Upload failed.',
      });
    }
  }, [id, load]);

  // ── playback (G-7 override) ─────────────────────────────────────────────────
  const onPlay = useCallback(async (media: MediaDTO) => {
    setPlayingMediaId(media.id);
    setPlaybackUrl(null);
    try {
      const { url } = await getMediaPlaybackUrl(media.id);
      setPlaybackUrl(url);
    } catch {
      setPlayingMediaId(null);
      Alert.alert('Playback', 'Could not load the video URL. Please try again.');
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {status.kind === 'loading' && (
          <View style={[styles.card, styles.cardNeutral]}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.cardTitle}>Loading event…</Text>
          </View>
        )}

        {status.kind === 'error' && (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.cardTitle}>✕ Could not load event</Text>
            <Text style={styles.cardBody}>{status.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {status.kind === 'success' && (
          <>
            <Text style={styles.heading}>Event detail</Text>

            {/* Read-only tap fields (the moat — not editable here, AC-4) */}
            <View style={styles.readonlyCard}>
              <ReadonlyRow label="Trigger" value={status.event.triggerType} />
              <ReadonlyRow label="Intensity" value={`${status.event.intensity}/10`} />
              <ReadonlyRow label="Threshold" value={`${status.event.thresholdMeters} m`} />
              <ReadonlyRow label="Outcome" value={status.event.outcome.replace(/_/g, ' ')} />
              <ReadonlyRow label="Intervention" value={status.event.intervention} />
              <ReadonlyRow label="When" value={formatDateTime(status.event.occurredAt)} />
            </View>

            {/* Editable note */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Note</Text>
              <TextInput
                style={styles.noteInput}
                multiline
                placeholder="Add a note about this event…"
                value={note}
                onChangeText={setNote}
                editable={!saving}
              />
            </View>

            {/* Editable tags */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Tags</Text>
              <View style={styles.tagRow}>
                {tags.length === 0 && <Text style={styles.muted}>No tags yet.</Text>}
                {tags.map((t) => (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    onPress={() => removeTag(t)}
                    style={({ pressed }) => [styles.tag, pressed && styles.pressed]}
                  >
                    <Text style={styles.tagText}>{t} ✕</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.tagAddRow}>
                <TextInput
                  style={[styles.input, styles.tagInput]}
                  placeholder="Add a tag"
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  onSubmitEditing={addTag}
                  autoCapitalize="none"
                  editable={!saving}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={addTag}
                  style={({ pressed }) => [styles.addTagButton, pressed && styles.pressed]}
                >
                  <Text style={styles.addTagButtonText}>Add</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void onSave()}
              style={({ pressed }) => [
                styles.primaryButton,
                saving && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save note & tags'}</Text>
            </Pressable>
            {saveError && <Text style={styles.errorText}>{saveError}</Text>}

            {/* ── Media ────────────────────────────────────────────────────── */}
            <Text style={styles.sectionTitle}>Media</Text>

            {status.event.media.length === 0 && (
              <Text style={styles.muted}>No media attached yet.</Text>
            )}

            {status.event.media.map((m) => (
              <View key={m.id} style={styles.mediaCard}>
                <View style={styles.mediaHeader}>
                  <Text style={styles.mediaTitle}>{m.type}</Text>
                  <Text style={styles.mediaMeta}>{formatDateTime(m.uploadedAt)}</Text>
                </View>
                <Text style={styles.mediaKey} numberOfLines={1}>
                  {filenameFromBlobUrl(m.blobUrl)}
                </Text>

                {playingMediaId === m.id ? (
                  playbackUrl ? (
                    <VideoPlayerView url={playbackUrl} />
                  ) : (
                    <View style={styles.playerLoading}>
                      <ActivityIndicator color="#2563eb" />
                      <Text style={styles.muted}>Loading video…</Text>
                    </View>
                  )
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void onPlay(m)}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryButtonText}>▶ Play</Text>
                  </Pressable>
                )}
              </View>
            ))}

            {/* Upload */}
            <Pressable
              accessibilityRole="button"
              disabled={upload.kind === 'uploading'}
              onPress={() => void onPickAndUpload()}
              style={({ pressed }) => [
                styles.uploadButton,
                upload.kind === 'uploading' && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.uploadButtonText}>
                {upload.kind === 'uploading' ? 'Uploading…' : '＋ Pick & upload video'}
              </Text>
            </Pressable>

            {upload.kind === 'uploading' && (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${Math.round(upload.progress * 100)}%` }]}
                  />
                </View>
                <Text style={styles.muted}>{Math.round(upload.progress * 100)}%</Text>
              </View>
            )}
            {upload.kind === 'error' && <Text style={styles.errorText}>{upload.message}</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.roRow}>
      <Text style={styles.roLabel}>{label}</Text>
      <Text style={styles.roValue}>{value}</Text>
    </View>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function filenameFromBlobUrl(blobUrl: string): string {
  const parts = blobUrl.split('/');
  return parts[parts.length - 1] || blobUrl;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: {
    padding: 20,
    gap: 14,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({ web: { minHeight: '100%' as unknown as number }, default: {} }),
  },
  heading: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  card: { borderRadius: 12, padding: 16, borderWidth: 1, gap: 8 },
  cardNeutral: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  cardBody: { fontSize: 14, color: '#334155' },
  readonlyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 6,
  },
  roRow: { flexDirection: 'row', justifyContent: 'space-between' },
  roLabel: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  roValue: { fontSize: 14, color: '#0f172a', textTransform: 'capitalize' },
  field: { gap: 8 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
    minHeight: 88,
    textAlignVertical: 'top',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  tag: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tagText: { fontSize: 13, color: '#1d4ed8', fontWeight: '600' },
  tagAddRow: { flexDirection: 'row', gap: 8 },
  tagInput: { flex: 1 },
  addTagButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addTagButtonText: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 8 },
  muted: { fontSize: 13, color: '#94a3b8' },
  mediaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 8,
  },
  mediaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mediaTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' },
  mediaMeta: { fontSize: 12, color: '#64748b' },
  mediaKey: { fontSize: 12, color: '#475569' },
  video: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#000000' },
  playerLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  uploadButton: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  uploadButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  progressWrap: { gap: 6 },
  progressTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: '#16a34a' },
  errorText: { fontSize: 14, color: '#991b1b' },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});
