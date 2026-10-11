// =============================================================================
// /manage/leads — website requests (Phase 3b-2, redesigned).
//
// A list + detail: filter tabs by stage (Νέα / Σε επαφή / Πελάτες / Αρχείο),
// pick a request, act on it. On wide screens list and detail sit side by side;
// on a phone the detail replaces the list with a back button.
//
// Actions per stage:
//   new / contacted → "Έγινε πελάτης" (POST /leads/:id/convert), "Σε επαφή"
//                     (PATCH /leads/:id/status), "Αρχειοθέτηση" (→ lost)
//   lost            → "Επαναφορά" (→ new)
//   converted       → create the client's login (POST /clients/:id/login). The
//                     trainer sets the first password; "Δημιουργία" fills in a
//                     strong one they can read out or send.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ClientDTO, LeadDTO, LeadStatus } from '@tailsup/shared';
import { colors, fontFallback, fonts, radii, useResponsive } from '../../../lib/theme';
import { useLang } from '../../../lib/i18n';
import { useSession } from '../../../lib/auth-client';
import { ApiError, convertLead, createClientLogin, getTrainerLeads, updateLeadStatus } from '../../../lib/api';
import { formatAgo, formatDayTime } from '../../../lib/labels';
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Muted,
  Notice,
  Panel,
  Pill,
  Screen,
  Title,
  type PillTone,
} from '../../../components/app/AppKit';
import {
  IconArchive,
  IconBack,
  IconCheckMark,
  IconEye,
  IconEyeOff,
  IconMailOutline,
  IconPhoneOutline,
} from '../../../components/app/AppIcons';

type Tab = 'new' | 'contacted' | 'converted' | 'lost';
const TABS: Tab[] = ['new', 'contacted', 'converted', 'lost'];

const copy = {
  el: {
    title: 'Αιτήματα',
    subtitle: 'Μηνύματα από τη φόρμα επικοινωνίας του ιστότοπου.',
    tabs: { new: 'Νέα', contacted: 'Σε επαφή', converted: 'Πελάτες', lost: 'Αρχείο' } as Record<Tab, string>,
    status: { new: 'Νέο', contacted: 'Σε επαφή', converted: 'Πελάτης', lost: 'Αρχείο' } as Record<LeadStatus, string>,
    loading: 'Φόρτωση…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    noTrainer: 'Ο λογαριασμός δεν έχει προφίλ εκπαιδευτή.',
    empty: { new: 'Κανένα νέο αίτημα.', contacted: 'Κανείς σε επαφή.', converted: 'Κανένας πελάτης από αιτήματα ακόμα.', lost: 'Το αρχείο είναι άδειο.' } as Record<Tab, string>,
    pick: 'Επιλέξτε ένα αίτημα για να δείτε τις λεπτομέρειες.',
    back: 'Πίσω στη λίστα',
    from: (src: string, when: string) => `Από ${src === 'website' || src.startsWith('website') ? 'τον ιστότοπο' : src} · ${when}`,
    message: 'Μήνυμα',
    noMessage: 'Χωρίς μήνυμα.',
    call: 'Κλήση',
    email: 'Email',
    next: 'Επόμενο βήμα',
    convert: 'Έγινε πελάτης',
    contacted: 'Σε επαφή',
    archive: 'Αρχειοθέτηση',
    restore: 'Επαναφορά',
    convertHint: 'Δημιουργεί τον πελάτη. Στη συνέχεια μπορείτε να του φτιάξετε λογαριασμό για την εφαρμογή.',
    login: 'Λογαριασμός πελάτη',
    loginHelp: 'Ορίστε email και αρχικό κωδικό και στείλτε τα στον πελάτη.',
    loginEmail: 'Email σύνδεσης',
    password: 'Κωδικός (τουλάχιστον 8 χαρακτήρες)',
    generate: 'Δημιουργία',
    show: 'Εμφάνιση κωδικού',
    hide: 'Απόκρυψη κωδικού',
    createLogin: 'Δημιουργία λογαριασμού',
    issued: (email: string) => `✓ Ο λογαριασμός δημιουργήθηκε για ${email}.`,
  },
  en: {
    title: 'Requests',
    subtitle: "Messages from the website's contact form.",
    tabs: { new: 'New', contacted: 'In touch', converted: 'Clients', lost: 'Archive' } as Record<Tab, string>,
    status: { new: 'New', contacted: 'In touch', converted: 'Client', lost: 'Archived' } as Record<LeadStatus, string>,
    loading: 'Loading…',
    errorTitle: 'Could not load requests',
    retry: 'Try again',
    noTrainer: 'This account has no trainer profile.',
    empty: { new: 'No new requests.', contacted: 'Nobody in touch.', converted: 'No clients from requests yet.', lost: 'The archive is empty.' } as Record<Tab, string>,
    pick: 'Pick a request to see the details.',
    back: 'Back to the list',
    from: (src: string, when: string) => `From ${src.startsWith('website') ? 'the website' : src} · ${when}`,
    message: 'Message',
    noMessage: 'No message.',
    call: 'Call',
    email: 'Email',
    next: 'Next step',
    convert: 'Became a client',
    contacted: 'In touch',
    archive: 'Archive',
    restore: 'Restore',
    convertHint: 'Creates the client. You can then set up their app login.',
    login: 'Client login',
    loginHelp: 'Set an email and a first password, then send them to the client.',
    loginEmail: 'Login email',
    password: 'Password (at least 8 characters)',
    generate: 'Generate',
    show: 'Show password',
    hide: 'Hide password',
    createLogin: 'Create login',
    issued: (email: string) => `✓ Login created for ${email}.`,
  },
} as const;

const STATUS_TONE: Record<LeadStatus, PillTone> = { new: 'peach', contacted: 'mint', converted: 'mint', lost: 'neutral' };

type Status = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; leads: LeadDTO[] };

const webCursor = Platform.select({ web: { cursor: 'pointer' } as object, default: {} });

function messageFor(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/** A readable 12-character password without look-alike characters. */
function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function contactLinks(contact: string): { email?: string; phone?: string } {
  const email = /[^\s@]+@[^\s@]+\.[^\s@]+/.exec(contact)?.[0];
  const phone = /\+?[\d\s-]{8,}/.exec(contact)?.[0]?.replace(/[\s-]/g, '');
  return { email, phone };
}

export default function LeadsScreen() {
  const { lang } = useLang();
  const c = copy[lang];
  const { isWide } = useResponsive();
  const { data: session } = useSession();
  const trainerId = session?.user?.trainerId ?? null;

  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>('new');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [clients, setClients] = useState<Record<string, ClientDTO>>({});
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [issued, setIssued] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    if (!trainerId) {
      setStatus({ kind: 'error', message: copy[lang].noTrainer });
      return;
    }
    try {
      const leads = await getTrainerLeads(trainerId);
      leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setStatus({ kind: 'ready', leads });
    } catch (err) {
      setStatus({ kind: 'error', message: messageFor(err) });
    }
  }, [trainerId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const leads = status.kind === 'ready' ? status.leads : [];
  const visible = useMemo(() => leads.filter((l) => l.status === tab), [leads, tab]);
  const selected = leads.find((l) => l.id === selectedId) ?? (isWide ? visible[0] : undefined);

  // Reset the login form whenever a different request is opened.
  useEffect(() => {
    setActionError(null);
    setPassword('');
    setShowPassword(false);
    setLoginEmail(selected ? (contactLinks(selected.contact).email ?? '') : '');
  }, [selected?.id]);

  const replace = (updated: LeadDTO) =>
    setStatus((s) => (s.kind === 'ready' ? { ...s, leads: s.leads.map((l) => (l.id === updated.id ? updated : l)) } : s));

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }, []);

  const onConvert = (lead: LeadDTO) =>
    run('convert', async () => {
      const res = await convertLead(lead.id);
      replace(res.lead);
      setClients((m) => ({ ...m, [lead.id]: res.client }));
      setTab('converted');
      setSelectedId(lead.id);
    });

  const onStatus = (lead: LeadDTO, next: 'new' | 'contacted' | 'lost') =>
    run(next, async () => {
      replace(await updateLeadStatus(lead.id, { status: next }));
      setTab(next);
      setSelectedId(lead.id);
    });

  const onCreateLogin = (lead: LeadDTO, clientId: string) =>
    run('login', async () => {
      const res = await createClientLogin(clientId, { email: loginEmail.trim(), password });
      setIssued((m) => ({ ...m, [lead.id]: res.email }));
    });

  const tabs = (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {TABS.map((t) => {
        const on = t === tab;
        const n = leads.filter((l) => l.status === t).length;
        return (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              setTab(t);
              setSelectedId(null);
            }}
            style={({ hovered, focused }) => [
              styles.tab,
              on ? styles.tabOn : hovered && styles.tabHover,
              focused && styles.focus,
              webCursor,
            ]}
          >
            <Text style={[styles.tabText, fontFallback.body, on && styles.tabTextOn]}>
              {c.tabs[t]} · {n}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const list = (
    <View style={styles.list}>
      {visible.length === 0 ? (
        <EmptyState message={c.empty[tab]} />
      ) : (
        visible.map((lead) => {
          const on = selected?.id === lead.id;
          return (
            <Pressable
              key={lead.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setSelectedId(lead.id)}
              style={({ hovered, focused }) => [
                styles.item,
                on && isWide && styles.itemOn,
                hovered && !on && styles.itemHover,
                focused && styles.focus,
                webCursor,
              ]}
            >
              <View style={styles.itemHead}>
                <Text numberOfLines={1} style={[styles.itemName, fontFallback.body]}>
                  {lead.name}
                </Text>
                <Text style={[styles.itemWhen, fontFallback.body]}>{formatAgo(lead.createdAt, lang)}</Text>
              </View>
              {lead.message ? (
                <Text numberOfLines={2} style={[styles.itemMsg, fontFallback.body]}>
                  «{lead.message}»
                </Text>
              ) : null}
            </Pressable>
          );
        })
      )}
    </View>
  );

  const detail = (lead: LeadDTO) => {
    const { email, phone } = contactLinks(lead.contact);
    const clientId = clients[lead.id]?.id ?? lead.clientId;
    const open = lead.status === 'new' || lead.status === 'contacted';
    return (
      <Panel style={styles.detail}>
        {!isWide && (
          <IconButton
            icon={<IconBack color={colors.primarySoft} />}
            accessibilityLabel={c.back}
            tone="outline"
            onPress={() => setSelectedId(null)}
          />
        )}
        <View style={styles.detailHead}>
          <View style={styles.detailTitle}>
            <Title size="md">{lead.name}</Title>
            <Muted size={14}>{c.from(lead.source, formatDayTime(lead.createdAt, lang))}</Muted>
          </View>
          <Pill label={c.status[lead.status]} tone={STATUS_TONE[lead.status]} />
        </View>

        <View style={styles.contactRow}>
          {email && (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(`mailto:${email}`)}
              style={({ hovered }) => [styles.contact, hovered && { opacity: 0.85 }, webCursor]}
            >
              <IconMailOutline size={18} color={colors.textOnPeach} />
              <Text numberOfLines={1} style={[styles.contactText, fontFallback.body]}>
                {email}
              </Text>
            </Pressable>
          )}
          {phone && (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(`tel:${phone}`)}
              style={({ hovered }) => [styles.contact, hovered && { opacity: 0.85 }, webCursor]}
            >
              <IconPhoneOutline size={18} color={colors.textOnPeach} />
              <Text style={[styles.contactText, fontFallback.body]}>
                {c.call} {phone}
              </Text>
            </Pressable>
          )}
          {!email && !phone && <Muted>{lead.contact}</Muted>}
        </View>

        <View style={styles.message}>
          <Text style={[styles.label, fontFallback.body]}>{c.message}</Text>
          <Text style={[styles.messageText, fontFallback.body]}>{lead.message || c.noMessage}</Text>
        </View>

        {open && (
          <View style={styles.block}>
            <Text style={[styles.label, fontFallback.body]}>{c.next}</Text>
            <View style={styles.actions}>
              <Button
                label={c.convert}
                loading={busy === 'convert'}
                disabled={!!busy}
                onPress={() => void onConvert(lead)}
                icon={<IconCheckMark size={18} color={colors.text} />}
              />
              {lead.status === 'new' && (
                <Button
                  label={c.contacted}
                  variant="secondary"
                  loading={busy === 'contacted'}
                  disabled={!!busy}
                  onPress={() => void onStatus(lead, 'contacted')}
                />
              )}
              <Button
                label={c.archive}
                variant="quiet"
                loading={busy === 'lost'}
                disabled={!!busy}
                onPress={() => void onStatus(lead, 'lost')}
                icon={<IconArchive size={18} color={colors.textMuted} />}
              />
            </View>
            <Muted size={14}>{c.convertHint}</Muted>
          </View>
        )}

        {lead.status === 'lost' && (
          <Button
            label={c.restore}
            variant="secondary"
            loading={busy === 'new'}
            onPress={() => void onStatus(lead, 'new')}
          />
        )}

        {lead.status === 'converted' && clientId && (
          <View style={styles.block}>
            <Text style={[styles.label, fontFallback.body]}>{c.login}</Text>
            {issued[lead.id] ? (
              <Notice tone="success">{c.issued(issued[lead.id])}</Notice>
            ) : (
              <>
                <Muted size={14}>{c.loginHelp}</Muted>
                <TextInput
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  placeholder={c.loginEmail}
                  placeholderTextColor={colors.placeholder}
                  accessibilityLabel={c.loginEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  inputMode="email"
                  autoComplete="off"
                  style={[styles.input, fontFallback.body]}
                />
                <View style={styles.passwordRow}>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder={c.password}
                      placeholderTextColor={colors.placeholder}
                      accessibilityLabel={c.password}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      style={[styles.input, styles.passwordInput, fontFallback.body]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? c.hide : c.show}
                      onPress={() => setShowPassword((v) => !v)}
                      style={[styles.eye, webCursor]}
                    >
                      {showPassword ? <IconEyeOff color={colors.textMuted} /> : <IconEye color={colors.textMuted} />}
                    </Pressable>
                  </View>
                  <Button
                    label={c.generate}
                    variant="secondary"
                    onPress={() => {
                      setPassword(generatePassword());
                      setShowPassword(true);
                    }}
                  />
                </View>
                <Button
                  label={c.createLogin}
                  variant="green"
                  loading={busy === 'login'}
                  disabled={!!busy || loginEmail.trim() === '' || password.length < 8}
                  onPress={() => void onCreateLogin(lead, clientId)}
                />
              </>
            )}
          </View>
        )}

        {actionError && <Notice tone="error">{actionError}</Notice>}
      </Panel>
    );
  };

  return (
    <Screen maxWidth={1100}>
      <View style={styles.header}>
        <Title>{c.title}</Title>
        <Muted size={16}>{c.subtitle}</Muted>
      </View>

      {status.kind === 'loading' && <LoadingState label={c.loading} />}
      {status.kind === 'error' && (
        <ErrorState title={c.errorTitle} message={status.message} retryLabel={c.retry} onRetry={() => void load()} />
      )}
      {status.kind === 'ready' &&
        (isWide ? (
          <>
            {tabs}
            <View style={styles.split}>
              <View style={styles.listCol}>{list}</View>
              <View style={styles.detailCol}>{selected ? detail(selected) : <EmptyState message={c.pick} />}</View>
            </View>
          </>
        ) : selected ? (
          detail(selected)
        ) : (
          <>
            {tabs}
            {list}
          </>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: colors.text, borderColor: colors.text },
  tabHover: { backgroundColor: colors.bgAlt },
  tabText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  tabTextOn: { fontFamily: fonts.bodyBold, color: colors.onDark },
  focus: { outlineColor: colors.accent, outlineWidth: 2, outlineStyle: 'solid' } as object,
  split: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  listCol: { flex: 1, minWidth: 260, maxWidth: 380 },
  detailCol: { flex: 2, minWidth: 0 },
  list: { gap: 10 },
  item: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.surface,
  },
  itemOn: { borderColor: colors.primary, borderWidth: 2 },
  itemHover: { backgroundColor: '#FFFDF8' },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  itemName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  itemWhen: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  itemMsg: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  detail: { gap: 18, padding: 22 },
  detailHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  detailTitle: { flex: 1, minWidth: 200, gap: 4 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.bgAlt,
    maxWidth: '100%',
  },
  contactText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.textOnPeach, flexShrink: 1 },
  message: { gap: 6, padding: 16, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: '#F3ECDF' },
  label: { fontFamily: fonts.bodyBold, fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
  messageText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.text },
  block: { gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
  passwordRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  passwordWrap: { flex: 1, justifyContent: 'center' },
  passwordInput: { paddingRight: 50 },
  eye: { position: 'absolute', right: 2, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
