// =============================================================================
// Session logging — the trainer's in-the-field screen (FR-M1/M2 / NFR-1).
//
// Speed is still the whole point: every field is pre-defaulted, so an
// unchanged field costs no tap, and the Log button sits fixed at the bottom
// within thumb reach. The screen runs in focus mode (no app chrome) and draws
// its own header with the dog's name and how many events this session holds.
//
//   - Trigger: five big buttons. "Άλλο" opens a short text field for what it
//     actually was (sent as `triggerDetail`, ≤ 100 chars).
//   - Distance: a −/+ stepper — 1 m steps up close, 5 m steps beyond 10 m.
//   - Intensity: a 1–10 bar with the level in words.
//   - Outcome: three buttons, worded as what the dog did.
//   - Intervention: defaults from the dog's protocol (server-side); "Αλλαγή"
//     lets the trainer type a different one for this event.
//
// After a save the fields reset for the next capture. On failure the
// selections are kept so a retry is one tap (R-5). A 400 with no intervention
// typed most likely means the dog has no protocol default (OQ-8), so the
// intervention field opens with a hint.
// =============================================================================

import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OUTCOMES, TRIGGER_TYPES } from '@tailsup/shared';
import type { CreateBehaviorEventInput, Outcome, TriggerType } from '@tailsup/shared';
import { colors, fontFallback, fonts, radii } from '../../../../lib/theme';
import { useLang } from '../../../../lib/i18n';
import { ApiError, postEvent } from '../../../../lib/api';
import { OUTCOME_LABELS, TRIGGER_LABELS, intensityWord } from '../../../../lib/labels';
import { Avatar, Button, IconButton, Notice,
} from '../../../../components/app/AppKit';
import {
  IconAlert,
  IconBack,
  IconCheckMark,
  IconMinus,
  IconPlus,
  IconVideo,
  IconWave,
} from '../../../../components/app/AppIcons';

const DEFAULT_TRIGGER: TriggerType = 'dog';
const DEFAULT_OUTCOME: Outcome = 'disengaged';
const DEFAULT_INTENSITY = 5;
const DEFAULT_THRESHOLD = 5;
const INTENSITY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const copy = {
  el: {
    session: 'Συνεδρία',
    count: (n: number) => (n === 0 ? 'Καμία καταγραφή ακόμα' : n === 1 ? '1 καταγραφή' : `${n} καταγραφές`),
    finish: 'Τέλος',
    back: 'Πίσω',
    trigger: 'Τι τον ενεργοποίησε;',
    otherPlaceholder: 'Τι ήταν; π.χ. ποδήλατο, γάτα',
    otherLabel: 'Τι ήταν;',
    distance: 'Απόσταση από το ερέθισμα',
    metres: 'μέτρα',
    less: 'Λιγότερα μέτρα',
    more: 'Περισσότερα μέτρα',
    intensity: 'Ένταση αντίδρασης',
    calm: 'Ήρεμος',
    wild: 'Εκτός ελέγχου',
    outcome: 'Πώς τα πήγε;',
    intervention: 'Παρέμβαση',
    fromProtocol: 'από το πρωτόκολλο',
    change: 'Αλλαγή',
    useProtocol: 'Από πρωτόκολλο',
    interventionPlaceholder: 'π.χ. u-turn, pattern game',
    noDefault: 'Αυτός ο σκύλος δεν έχει προεπιλεγμένη παρέμβαση. Γράψτε ποια κάνατε.',
    log: 'Καταγραφή',
    logVideo: 'Καταγραφή και προσθήκη βίντεο',
    saved: (n: number) => `✓ Καταγράφηκε. Έτοιμο για το επόμενο (${n} σε αυτή τη συνεδρία).`,
    failed: 'Δεν καταγράφηκε:',
    retryHint: 'Οι επιλογές σας κρατήθηκαν — πατήστε ξανά Καταγραφή.',
  },
  en: {
    session: 'Session',
    count: (n: number) => (n === 0 ? 'Nothing logged yet' : n === 1 ? '1 event' : `${n} events`),
    finish: 'Finish',
    back: 'Back',
    trigger: 'What set them off?',
    otherPlaceholder: 'What was it? e.g. bicycle, cat',
    otherLabel: 'What was it?',
    distance: 'Distance from the trigger',
    metres: 'metres',
    less: 'Fewer metres',
    more: 'More metres',
    intensity: 'Reaction intensity',
    calm: 'Calm',
    wild: 'Out of control',
    outcome: 'How did it go?',
    intervention: 'Intervention',
    fromProtocol: 'from the protocol',
    change: 'Change',
    useProtocol: 'Use protocol',
    interventionPlaceholder: 'e.g. u-turn, pattern game',
    noDefault: "This dog has no default intervention. Type the one you used.",
    log: 'Log',
    logVideo: 'Log and add a video',
    saved: (n: number) => `✓ Logged. Ready for the next one (${n} this session).`,
    failed: 'Not logged:',
    retryHint: 'Your selections are kept — tap Log again.',
  },
} as const;

/** 1 m steps up close (where the training happens), 5 m steps further out. */
function stepDistance(m: number, dir: 1 | -1): number {
  if (dir === 1) return m < 10 ? m + 1 : Math.min(m + 5, 200);
  return m <= 10 ? Math.max(m - 1, 0) : m - 5;
}

const webCursor = Platform.select({ web: { cursor: 'pointer' } as object, default: {} });

function Choice({
  label,
  selected,
  onPress,
  disabled,
  icon,
  tall = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
  icon?: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, focused }) => [
        styles.choice,
        tall && styles.choiceTall,
        selected ? (tall ? styles.choiceOutcomeOn : styles.choiceOn) : hovered && styles.choiceHover,
        focused && styles.focus,
        webCursor,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.choiceText,
          fontFallback.body,
          selected && { fontFamily: fonts.bodyBold, color: tall ? colors.primarySoft : colors.onDark },
          tall && styles.choiceTextTall,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type Submit =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

export default function LogScreen() {
  const router = useRouter();
  const { lang } = useLang();
  const c = copy[lang];
  const { id: sessionId, dog: dogName, dogId } = useLocalSearchParams<{ id: string; dog?: string; dogId?: string }>();

  const [triggerType, setTriggerType] = useState<TriggerType>(DEFAULT_TRIGGER);
  const [triggerDetail, setTriggerDetail] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(DEFAULT_OUTCOME);
  const [intensity, setIntensity] = useState<number>(DEFAULT_INTENSITY);
  const [thresholdMeters, setThresholdMeters] = useState<number>(DEFAULT_THRESHOLD);
  const [editIntervention, setEditIntervention] = useState(false);
  const [intervention, setIntervention] = useState('');
  const [needsIntervention, setNeedsIntervention] = useState(false);
  const [submit, setSubmit] = useState<Submit>({ kind: 'idle' });
  const [savedCount, setSavedCount] = useState(0);

  const saving = submit.kind === 'saving';

  const reset = useCallback(() => {
    setTriggerType(DEFAULT_TRIGGER);
    setTriggerDetail('');
    setOutcome(DEFAULT_OUTCOME);
    setIntensity(DEFAULT_INTENSITY);
    setThresholdMeters(DEFAULT_THRESHOLD);
    // A typed intervention usually holds for the whole session — keep it.
  }, []);

  const doSubmit = useCallback(
    async (thenAddVideo: boolean) => {
      setSubmit({ kind: 'saving' });
      const typed = editIntervention ? intervention.trim() : '';
      const detail = triggerType === 'other' ? triggerDetail.trim() : '';
      const body: CreateBehaviorEventInput = {
        triggerType,
        thresholdMeters,
        intensity,
        outcome,
        ...(detail ? { triggerDetail: detail } : {}),
        ...(typed ? { intervention: typed } : {}),
      };
      try {
        const created = await postEvent(sessionId, body);
        setSavedCount((n) => n + 1);
        setNeedsIntervention(false);
        reset();
        setSubmit({ kind: 'saved' });
        if (thenAddVideo) router.push({ pathname: '/events/[id]', params: { id: created.id } });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 400 && !typed) {
          setNeedsIntervention(true);
          setEditIntervention(true);
        }
        setSubmit({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) });
      }
    },
    [sessionId, triggerType, triggerDetail, thresholdMeters, intensity, outcome, editIntervention, intervention, reset, router],
  );

  const finish = () => {
    if (dogId) router.replace({ pathname: '/dogs/[id]/timeline', params: { id: dogId } });
    else if (router.canGoBack()) router.back();
    else router.replace('/dogs');
  };

  const blockedByIntervention = editIntervention && needsIntervention && intervention.trim() === '';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.header}>
        <View style={styles.headerInner}>
          <IconButton
            icon={<IconBack color={colors.primarySoft} />}
            accessibilityLabel={c.back}
            tone="onDark"
            onPress={finish}
          />
          {dogName ? <Avatar name={dogName} size={38} /> : null}
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={[styles.headerTitle, fontFallback.display]}>
              {dogName ? `${dogName} · ${c.session}` : c.session}
            </Text>
            <Text style={[styles.headerSub, fontFallback.body]}>{c.count(savedCount)}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={finish} style={({ hovered }) => [styles.finish, hovered && { opacity: 0.85 }, webCursor]}>
            <Text style={[styles.finishText, fontFallback.body]}>{c.finish}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.body}>
          {/* Trigger */}
          <View style={styles.field}>
            <Text style={[styles.label, fontFallback.body]}>{c.trigger}</Text>
            <View accessibilityRole="radiogroup" style={styles.grid3}>
              {TRIGGER_TYPES.map((t) => (
                <View key={t} style={styles.cell3}>
                  <Choice
                    label={TRIGGER_LABELS[lang][t]}
                    selected={triggerType === t}
                    disabled={saving}
                    onPress={() => setTriggerType(t)}
                  />
                </View>
              ))}
            </View>
            {triggerType === 'other' && (
              <TextInput
                value={triggerDetail}
                onChangeText={setTriggerDetail}
                placeholder={c.otherPlaceholder}
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={c.otherLabel}
                maxLength={100}
                autoFocus
                editable={!saving}
                returnKeyType="done"
                style={[styles.input, styles.inputFocus, fontFallback.body]}
              />
            )}
          </View>

          {/* Distance */}
          <View style={styles.field}>
            <Text style={[styles.label, fontFallback.body]}>{c.distance}</Text>
            <View style={styles.stepper}>
              <IconButton
                icon={<IconMinus color={colors.primarySoft} />}
                accessibilityLabel={c.less}
                tone="outline"
                size={54}
                disabled={saving || thresholdMeters === 0}
                onPress={() => setThresholdMeters((m) => stepDistance(m, -1))}
              />
              <View style={styles.distance} accessible accessibilityLabel={`${thresholdMeters} ${c.metres}`}>
                <Text style={[styles.distanceValue, fontFallback.display]}>{thresholdMeters}</Text>
                <Text style={[styles.distanceUnit, fontFallback.body]}>{c.metres}</Text>
              </View>
              <IconButton
                icon={<IconPlus color={colors.primarySoft} />}
                accessibilityLabel={c.more}
                tone="outline"
                size={54}
                disabled={saving}
                onPress={() => setThresholdMeters((m) => stepDistance(m, 1))}
              />
            </View>
          </View>

          {/* Intensity */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, fontFallback.body]}>{c.intensity}</Text>
              <Text style={[styles.labelValue, fontFallback.body]}>
                {intensity} / 10 · {intensityWord(intensity, lang)}
              </Text>
            </View>
            <View accessibilityRole="radiogroup" style={styles.bar}>
              {INTENSITY_VALUES.map((v) => {
                const on = v === intensity;
                return (
                  <Pressable
                    key={v}
                    accessibilityRole="radio"
                    accessibilityLabel={`${v}`}
                    accessibilityState={{ checked: on }}
                    disabled={saving}
                    onPress={() => setIntensity(v)}
                    style={({ focused }) => [
                      styles.barCell,
                      { backgroundColor: v < intensity ? colors.mint : on ? colors.primary : '#F3ECDF' },
                      on && styles.barCellOn,
                      focused && styles.focus,
                      webCursor,
                    ]}
                  >
                    <Text style={[styles.barText, fontFallback.body, { color: on ? colors.onDark : colors.textMuted }]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.labelRow}>
              <Text style={[styles.scaleEnd, fontFallback.body]}>{c.calm}</Text>
              <Text style={[styles.scaleEnd, fontFallback.body]}>{c.wild}</Text>
            </View>
          </View>

          {/* Outcome */}
          <View style={styles.field}>
            <Text style={[styles.label, fontFallback.body]}>{c.outcome}</Text>
            <View accessibilityRole="radiogroup" style={styles.grid3}>
              {OUTCOMES.map((o) => {
                const on = outcome === o;
                const icon =
                  o === 'disengaged' ? (
                    <IconCheckMark size={20} color={colors.primary} />
                  ) : o === 'recovered_slowly' ? (
                    <IconWave size={20} color={colors.accent} />
                  ) : (
                    <IconAlert size={20} color={colors.danger} />
                  );
                return (
                  <View key={o} style={styles.cell3}>
                    <Choice
                      tall
                      icon={icon}
                      label={OUTCOME_LABELS[lang][o]}
                      selected={on}
                      disabled={saving}
                      onPress={() => setOutcome(o)}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          {/* Intervention */}
          <View style={styles.intervention}>
            <View style={styles.interventionText}>
              <Text style={[styles.interventionLabel, fontFallback.body]}>{c.intervention}</Text>
              {editIntervention ? (
                <TextInput
                  value={intervention}
                  onChangeText={setIntervention}
                  placeholder={c.interventionPlaceholder}
                  placeholderTextColor={colors.placeholder}
                  accessibilityLabel={c.intervention}
                  autoCapitalize="none"
                  editable={!saving}
                  style={[styles.inlineInput, fontFallback.body]}
                />
              ) : (
                <Text style={[styles.interventionValue, fontFallback.body]}>{c.fromProtocol}</Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditIntervention((v) => !v);
                setIntervention('');
              }}
              style={({ hovered }) => [styles.smallButton, hovered && { opacity: 0.85 }, webCursor]}
            >
              <Text style={[styles.smallButtonText, fontFallback.body]}>{editIntervention ? c.useProtocol : c.change}</Text>
            </Pressable>
          </View>
          {needsIntervention && <Notice tone="info">{c.noDefault}</Notice>}

          {submit.kind === 'saved' && <Notice tone="success">{c.saved(savedCount)}</Notice>}
          {submit.kind === 'error' && (
            <Notice tone="error">
              {c.failed} {submit.message} {c.retryHint}
            </Notice>
          )}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.footer}>
        <View style={styles.footerInner}>
          <IconButton
            icon={<IconVideo color={colors.primarySoft} />}
            accessibilityLabel={c.logVideo}
            tone="outline"
            size={56}
            disabled={saving || blockedByIntervention}
            onPress={() => void doSubmit(true)}
          />
          <View style={styles.footerMain}>
            <Button
              label={c.log}
              size="lg"
              block
              loading={saving}
              disabled={blockedByIntervention}
              onPress={() => void doSubmit(false)}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const MAX = 560;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.primarySoft },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
    maxWidth: MAX + 24,
    alignSelf: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.onDark },
  headerSub: { fontFamily: fonts.body, fontSize: 13, color: colors.onDarkMuted },
  finish: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,252,245,0.16)',
    justifyContent: 'center',
  },
  finishText: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.onDark },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, alignItems: 'center' },
  body: { width: '100%', maxWidth: MAX, gap: 18 },
  field: { gap: 8 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  labelValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell3: { width: '33.333%', padding: 4 },
  choice: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  choiceTall: { minHeight: 76, gap: 4, paddingVertical: 8, borderRadius: 16 },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceOutcomeOn: { backgroundColor: colors.mintSoft, borderColor: colors.primary, borderWidth: 2 },
  choiceHover: { backgroundColor: '#FFFDF8', borderColor: colors.mint },
  choiceText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text, textAlign: 'center' },
  choiceTextTall: { fontSize: 14, lineHeight: 18 },
  focus: { outlineColor: colors.accent, outlineWidth: 2, outlineStyle: 'solid' } as object,
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
  inputFocus: { borderColor: colors.primary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  distance: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.bgAlt,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  distanceValue: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.text },
  distanceUnit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.textOnPeach },
  bar: { flexDirection: 'row', gap: 4 },
  barCell: { flex: 1, height: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  barCellOn: { transform: [{ scaleY: 1.08 }] },
  barText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  scaleEnd: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  intervention: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.surface,
  },
  interventionText: { flex: 1, minWidth: 0, gap: 2 },
  interventionLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.textMuted },
  interventionValue: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  inlineInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
  },
  smallButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.bgAlt,
    justifyContent: 'center',
  },
  smallButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textOnPeach },
  footer: { backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: '#F3ECDF' },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    width: '100%',
    maxWidth: MAX + 32,
    alignSelf: 'center',
  },
  footerMain: { flex: 1 },
});
