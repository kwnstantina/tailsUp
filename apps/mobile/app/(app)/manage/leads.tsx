// =============================================================================
// /manage/leads — TRAINER lead triage (Phase 3b-2, Unit C2 · AC-3b-9)
//
// Reads the trainer id from the session, lists incoming leads newest-first with
// a StatusBadge, and drives the two-step provisioning flow (DG-1):
//   1. Convert  — POST /leads/:id/convert creates the domain client + flips the
//      lead to 'converted' (shown for 'new'/'contacted' leads).
//   2. Create login — once converted, a mini-form (email + password) calls
//      POST /clients/:id/login to issue the client's BetterAuth login.
// ApiError messages (409 already-converted / email-exists, 404 not-theirs) are
// surfaced inline. Loading via the discriminated-union Status pattern.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ClientDTO, LeadDTO } from '@tailsup/shared';
import { colors, fontFallback, layout, radii, space, type as t } from '../../../lib/theme';
import { useLang, type Lang } from '../../../lib/i18n';
import { useSession } from '../../../lib/auth-client';
import { ApiError, convertLead, createClientLogin, getTrainerLeads } from '../../../lib/api';
import { StatusBadge } from '../../../components/StatusBadge';

const copy = {
  el: {
    heading: 'Ενδιαφερόμενοι',
    subheading: 'Νέα αιτήματα από τον ιστότοπο — μετατροπή σε πελάτη και δημιουργία λογαριασμού.',
    loading: 'Φόρτωση…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    noTrainer: 'Ο λογαριασμός δεν έχει προφίλ εκπαιδευτή. Συνδέσου ως εκπαιδευτής.',
    empty: 'Δεν υπάρχουν ενδιαφερόμενοι ακόμη.',
    source: 'Πηγή',
    convert: 'Μετατροπή σε πελάτη',
    converting: 'Μετατροπή…',
    convertedTo: (name: string) => `Μετατράπηκε σε πελάτη: ${name}`,
    createLogin: 'Δημιουργία λογαριασμού',
    creating: 'Δημιουργία…',
    email: 'Email',
    password: 'Κωδικός (≥ 8 χαρακτήρες)',
    loginIssued: (email: string) => `✓ Ο λογαριασμός δημιουργήθηκε για ${email}`,
  },
  en: {
    heading: 'Leads',
    subheading: 'Incoming website enquiries — convert to a client and issue a login.',
    loading: 'Loading…',
    errorTitle: 'Could not load leads',
    retry: 'Try again',
    noTrainer: 'This account has no trainer profile. Sign in as a trainer.',
    empty: 'No leads yet.',
    source: 'Source',
    convert: 'Convert to client',
    converting: 'Converting…',
    convertedTo: (name: string) => `Converted to client: ${name}`,
    createLogin: 'Create login',
    creating: 'Creating…',
    email: 'Email',
    password: 'Password (≥ 8 characters)',
    loginIssued: (email: string) => `✓ Login issued for ${email}`,
  },
} as const;

type Copy = (typeof copy)[Lang];

type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; leads: LeadDTO[] }
  | { kind: 'error'; message: string };

interface LoginForm {
  email: string;
  password: string;
  submitting: boolean;
  error: string | null;
  issuedEmail: string | null;
}

const EMPTY_FORM: LoginForm = { email: '', password: '', submitting: false, error: null, issuedEmail: null };

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

export default function ManageLeadsScreen() {
  const { lang } = useLang();
  const c = copy[lang];
  const { data: session } = useSession();
  const trainerId = session?.user?.trainerId ?? null;

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<{ id: string; message: string } | null>(null);
  // clientId per lead (from convert this session) so we can provision the login.
  const [clientByLead, setClientByLead] = useState<Record<string, ClientDTO>>({});
  // login mini-form state keyed by leadId.
  const [forms, setForms] = useState<Record<string, LoginForm>>({});

  const load = useCallback(async () => {
    setStatus({ kind: 'pending' });
    if (!trainerId) {
      setStatus({ kind: 'error', message: copy[lang].noTrainer });
      return;
    }
    try {
      const leads = await getTrainerLeads(trainerId);
      // Defensive newest-first (server already orders by createdAt desc).
      leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setStatus({ kind: 'success', leads });
    } catch (err) {
      setStatus({ kind: 'error', message: messageFor(err) });
    }
  }, [trainerId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const onConvert = useCallback(async (lead: LeadDTO) => {
    setConvertingId(lead.id);
    setConvertError(null);
    try {
      const res = await convertLead(lead.id);
      setStatus((s) =>
        s.kind === 'success'
          ? { ...s, leads: s.leads.map((l) => (l.id === lead.id ? res.lead : l)) }
          : s,
      );
      setClientByLead((m) => ({ ...m, [lead.id]: res.client }));
      // Prefill the login email with the client contact if it looks like one.
      setForms((m) => ({
        ...m,
        [lead.id]: {
          ...EMPTY_FORM,
          email: res.client.contact.includes('@') ? res.client.contact : '',
        },
      }));
    } catch (err) {
      setConvertError({ id: lead.id, message: messageFor(err) });
    } finally {
      setConvertingId(null);
    }
  }, []);

  const updateForm = useCallback((leadId: string, patch: Partial<LoginForm>) => {
    setForms((m) => ({ ...m, [leadId]: { ...(m[leadId] ?? EMPTY_FORM), ...patch } }));
  }, []);

  const onCreateLogin = useCallback(
    async (leadId: string, clientId: string) => {
      const form = forms[leadId] ?? EMPTY_FORM;
      updateForm(leadId, { submitting: true, error: null });
      try {
        const issued = await createClientLogin(clientId, {
          email: form.email.trim(),
          password: form.password,
        });
        updateForm(leadId, { submitting: false, issuedEmail: issued.email, error: null });
      } catch (err) {
        updateForm(leadId, { submitting: false, error: messageFor(err) });
      }
    },
    [forms, updateForm],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>{c.heading}</Text>
        <Text style={styles.subheading}>{c.subheading}</Text>

        {(status.kind === 'idle' || status.kind === 'pending') && (
          <View style={[styles.card, styles.cardRow]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.cardBody}>{c.loading}</Text>
          </View>
        )}

        {status.kind === 'error' && (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.cardTitle}>{c.errorTitle}</Text>
            <Text style={styles.cardBody}>{status.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ focused, pressed }) => [
                styles.primaryButton,
                focused && styles.focusRing,
                pressed && styles.pressed,
                Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
              ]}
            >
              <Text style={styles.primaryButtonText}>{c.retry}</Text>
            </Pressable>
          </View>
        )}

        {status.kind === 'success' && status.leads.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardBody}>{c.empty}</Text>
          </View>
        )}

        {status.kind === 'success' &&
          status.leads.map((lead) => {
            const convertible = lead.status === 'new' || lead.status === 'contacted';
            const client = clientByLead[lead.id];
            const clientId = client?.id ?? lead.clientId;
            const form = forms[lead.id] ?? EMPTY_FORM;
            const showLoginForm = lead.status === 'converted' && !!clientId;
            return (
              <View key={lead.id} style={styles.leadCard}>
                <View style={styles.leadHeader}>
                  <Text style={styles.leadName}>{lead.name}</Text>
                  <StatusBadge status={lead.status} />
                </View>
                <Text style={styles.leadMeta}>{lead.contact}</Text>
                <Text style={styles.leadMeta}>
                  {c.source}: {lead.source}
                </Text>
                {lead.message ? <Text style={styles.leadMessage}>{lead.message}</Text> : null}

                {convertible && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      disabled={convertingId === lead.id}
                      onPress={() => void onConvert(lead)}
                      style={({ focused, pressed }) => [
                        styles.primaryButton,
                        focused && styles.focusRing,
                        pressed && styles.pressed,
                        convertingId === lead.id && styles.blocked,
                        Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {convertingId === lead.id ? c.converting : c.convert}
                      </Text>
                    </Pressable>
                    {convertError?.id === lead.id && (
                      <Text style={styles.errorText}>{convertError.message}</Text>
                    )}
                  </>
                )}

                {showLoginForm && (
                  <View style={styles.loginBlock}>
                    {client && <Text style={styles.convertedText}>{c.convertedTo(client.name)}</Text>}
                    {form.issuedEmail ? (
                      <Text style={styles.issuedText}>{c.loginIssued(form.issuedEmail)}</Text>
                    ) : (
                      <>
                        <Text style={styles.label}>{c.email}</Text>
                        <TextInput
                          value={form.email}
                          onChangeText={(v) => updateForm(lead.id, { email: v })}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          inputMode="email"
                          accessibilityLabel={c.email}
                          style={styles.input}
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.label}>{c.password}</Text>
                        <TextInput
                          value={form.password}
                          onChangeText={(v) => updateForm(lead.id, { password: v })}
                          secureTextEntry
                          autoCapitalize="none"
                          accessibilityLabel={c.password}
                          style={styles.input}
                          placeholderTextColor={colors.textMuted}
                        />
                        <Pressable
                          accessibilityRole="button"
                          disabled={form.submitting}
                          onPress={() => clientId && void onCreateLogin(lead.id, clientId)}
                          style={({ focused, pressed }) => [
                            styles.primaryButton,
                            focused && styles.focusRing,
                            pressed && styles.pressed,
                            form.submitting && styles.blocked,
                            Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
                          ]}
                        >
                          <Text style={styles.primaryButtonText}>
                            {form.submitting ? c.creating : c.createLogin}
                          </Text>
                        </Pressable>
                        {form.error && <Text style={styles.errorText}>{form.error}</Text>}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: space.md,
    gap: space.sm,
    maxWidth: layout.maxProse,
    width: '100%',
    alignSelf: 'center',
  },
  heading: { ...t.h2, ...fontFallback.display, color: colors.text },
  subheading: { ...t.body, ...fontFallback.body, color: colors.textMuted, marginTop: -space.xs },
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md,
    gap: space.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardError: { backgroundColor: '#FBEAEA', borderColor: '#E4B7B7' },
  cardTitle: { ...t.h3, ...fontFallback.display, color: colors.text },
  cardBody: { ...t.body, ...fontFallback.body, color: colors.textMuted },
  leadCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md,
    gap: space.xs,
  },
  leadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  leadName: { ...t.h3, ...fontFallback.display, color: colors.text, flexShrink: 1 },
  leadMeta: { ...t.caption, ...fontFallback.body, color: colors.textMuted },
  leadMessage: { ...t.body, ...fontFallback.body, color: colors.text, marginTop: space.xs },
  loginBlock: {
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 6,
  },
  convertedText: { ...t.body, ...fontFallback.body, color: colors.primary },
  issuedText: { ...t.body, ...fontFallback.body, color: colors.primary },
  label: { ...t.caption, ...fontFallback.body, color: colors.text, marginTop: space.xs },
  input: {
    ...t.body,
    ...fontFallback.body,
    color: colors.text,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.base,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...Platform.select({ web: { outlineColor: colors.accent } as object, default: {} }),
  },
  errorText: { ...t.body, ...fontFallback.body, color: '#B00020', marginTop: space.xs },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radii.base,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: space.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  primaryButtonText: { ...t.body, ...fontFallback.body, color: colors.bg },
  focusRing: { borderColor: colors.accent },
  pressed: { opacity: 0.85 },
  blocked: { opacity: 0.6 },
});
