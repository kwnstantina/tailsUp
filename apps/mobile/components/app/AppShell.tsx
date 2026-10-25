// =============================================================================
// AppShell — navigation chrome for the authed app.
//
// Trainer: a deep-green sidebar on wide screens (Σήμερα / Σκύλοι / Κρατήσεις /
// Αιτήματα, with orange counts for what needs a reply), a top bar + bottom tab
// bar on phones. Client: a slim top bar — their dashboard is one page.
//
// The session logging screen runs in FOCUS mode (no chrome): it is used
// one-handed in a park and owns the whole screen, header included.
// =============================================================================

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFallback, fonts, radii, useResponsive } from '../../lib/theme';
import { useLang, type Lang } from '../../lib/i18n';
import { authClient } from '../../lib/auth-client';
import { getTrainerBookings, getTrainerLeads } from '../../lib/api';
import { LogoMark, LogoMarkOnDark } from '../ui';
import { Avatar, CountBadge,
} from './AppKit';
import { IconCalendar, IconDogs, IconHome, IconInbox, IconLogout } from './AppIcons';

export const TRAINER_HOME = '/today' as Href;
export const CLIENT_HOME = '/client' as Href;

type NavKey = 'today' | 'dogs' | 'bookings' | 'leads';

interface NavItem {
  key: NavKey;
  href: Href;
  label: Record<Lang, string>;
  icon: (color: string) => ReactNode;
  match: (path: string) => boolean;
}

const TRAINER_NAV: NavItem[] = [
  {
    key: 'today',
    href: TRAINER_HOME,
    label: { el: 'Σήμερα', en: 'Today' },
    icon: (c) => <IconHome color={c} />,
    match: (p) => p === '/today',
  },
  {
    key: 'dogs',
    href: '/dogs' as Href,
    label: { el: 'Σκύλοι', en: 'Dogs' },
    icon: (c) => <IconDogs color={c} />,
    match: (p) => p.startsWith('/dogs') || p.startsWith('/events'),
  },
  {
    key: 'bookings',
    href: '/manage/bookings' as Href,
    label: { el: 'Κρατήσεις', en: 'Bookings' },
    icon: (c) => <IconCalendar color={c} />,
    match: (p) => p.startsWith('/manage/bookings'),
  },
  {
    key: 'leads',
    href: '/manage/leads' as Href,
    label: { el: 'Αιτήματα', en: 'Requests' },
    icon: (c) => <IconInbox color={c} />,
    match: (p) => p.startsWith('/manage/leads'),
  },
];

const SIGN_OUT: Record<Lang, string> = { el: 'Αποσύνδεση', en: 'Sign out' };

const webCursor = Platform.select({ web: { cursor: 'pointer' } as object, default: {} });

/** Badge counts: new requests and bookings waiting for an answer. */
function useTrainerCounts(trainerId: string | null, pathname: string) {
  const [counts, setCounts] = useState<Partial<Record<NavKey, number>>>({});
  useEffect(() => {
    if (!trainerId) return;
    let live = true;
    Promise.all([getTrainerLeads(trainerId), getTrainerBookings(trainerId)])
      .then(([leads, bookings]) => {
        if (!live) return;
        setCounts({
          leads: leads.filter((l) => l.status === 'new').length,
          bookings: bookings.filter((b) => b.status === 'requested').length,
        });
      })
      .catch(() => {
        // Counts are a convenience — a failed fetch just hides the badges.
      });
    return () => {
      live = false;
    };
    // Refresh when the trainer moves between screens, so a handled request clears.
  }, [trainerId, pathname]);
  return counts;
}

function LangSwitch({ onDark }: { onDark: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <View style={styles.langRow} accessibilityRole="radiogroup">
      {(['el', 'en'] as const).map((l) => {
        const active = lang === l;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => setLang(l)}
            style={[
              styles.langButton,
              active && { backgroundColor: onDark ? colors.onDark : colors.primarySoft },
              webCursor,
            ]}
          >
            <Text
              style={[
                styles.langText,
                fontFallback.body,
                { color: active ? (onDark ? colors.primarySoft : colors.onDark) : onDark ? colors.onDarkMuted : colors.textMuted },
              ]}
            >
              {l.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AppShell({
  role,
  userName,
  trainerId,
  children,
}: {
  role: 'trainer' | 'client';
  userName: string;
  trainerId: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLang();
  const { width } = useResponsive();
  const sidebar = role === 'trainer' && width >= 1024;
  const counts = useTrainerCounts(role === 'trainer' ? trainerId : null, pathname);

  // No router.replace('/login') here: navigating while the session is still
  // cached remounts the current screen, which refetches and gets 401s. Once the
  // session clears, the (app) layout's guard redirects to /login by itself.
  const signOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  // Focus mode: the logging screen draws its own header.
  if (/^\/sessions\/[^/]+\/log/.test(pathname)) return <>{children}</>;

  if (sidebar) {
    return (
      <View style={styles.row}>
        <SafeAreaView edges={['top', 'bottom', 'left']} style={styles.sidebar}>
          <View style={styles.brand}>
            <LogoMarkOnDark size={34} />
            <Text style={[styles.brandText, fontFallback.display, { color: colors.onDark }]}>TailsUp</Text>
          </View>
          <View accessibilityRole="menu" style={styles.navList}>
            {TRAINER_NAV.map((item) => {
              const active = item.match(pathname);
              const fg = active ? colors.primarySoft : colors.onDarkMuted;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  onPress={() => router.push(item.href)}
                  style={({ hovered, focused }) => [
                    styles.navItem,
                    active ? styles.navItemActive : hovered && styles.navItemHover,
                    focused && styles.focusOnDark,
                    webCursor,
                  ]}
                >
                  {item.icon(fg)}
                  <Text style={[styles.navText, fontFallback.body, { color: fg }, active && styles.navTextActive]}>
                    {item.label[lang]}
                  </Text>
                  <View style={styles.spacer} />
                  <CountBadge count={counts[item.key] ?? 0} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.spacer} />
          <LangSwitch onDark />
          <View style={styles.userRow}>
            <Avatar name={userName} size={38} />
            <View style={styles.userText}>
              <Text numberOfLines={1} style={[styles.userName, fontFallback.body]}>
                {userName}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => void signOut()} style={webCursor}>
                <Text style={[styles.signOut, fontFallback.body]}>{SIGN_OUT[lang]}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.column}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.topBar}>
        <View style={styles.topBarInner}>
          <View style={styles.brand}>
            <LogoMark size={30} />
            <Text style={[styles.brandText, fontFallback.display, { color: colors.text }]}>TailsUp</Text>
          </View>
          <View style={styles.topBarRight}>
            <LangSwitch onDark={false} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={SIGN_OUT[lang]}
              onPress={() => void signOut()}
              style={({ hovered }) => [styles.topIcon, hovered && { backgroundColor: colors.bgAlt }, webCursor]}
            >
              <IconLogout color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      <View style={styles.content}>{children}</View>
      {role === 'trainer' && (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.tabBar}>
          <View accessibilityRole="tablist" style={styles.tabRow}>
            {TRAINER_NAV.map((item) => {
              const active = item.match(pathname);
              const fg = active ? colors.primarySoft : colors.textMuted;
              const count = counts[item.key] ?? 0;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => router.push(item.href)}
                  style={[styles.tab, webCursor]}
                >
                  <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                    {item.icon(fg)}
                    {count > 0 && <View style={styles.tabDot} />}
                  </View>
                  <Text style={[styles.tabText, fontFallback.body, { color: fg }, active && styles.navTextActive]}>
                    {item.label[lang]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  column: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, minWidth: 0 },
  spacer: { flex: 1 },
  sidebar: {
    width: 248,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 6,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingBottom: 4 },
  brandText: { fontFamily: fonts.display, fontSize: 21 },
  navList: { gap: 4, marginTop: 20 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemActive: { backgroundColor: colors.onDark },
  navItemHover: { backgroundColor: 'rgba(255,252,245,0.08)' },
  focusOnDark: { outlineColor: colors.accentSoft, outlineWidth: 2, outlineStyle: 'solid' } as object,
  navText: { fontFamily: fonts.bodySemiBold, fontSize: 15.5 },
  navTextActive: { fontFamily: fonts.bodyBold },
  langRow: { flexDirection: 'row', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 4 },
  langButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, minHeight: 30, justifyContent: 'center' },
  langText: { fontFamily: fonts.bodyBold, fontSize: 12.5, letterSpacing: 0.6 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,252,245,0.15)',
  },
  userText: { flex: 1, minWidth: 0 },
  userName: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.onDark },
  signOut: { fontFamily: fonts.body, fontSize: 13.5, color: colors.onDarkFaint, paddingVertical: 2 },
  topBar: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.fieldBorder },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topIcon: { width: 44, height: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  tabBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.fieldBorder },
  tabRow: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4, minHeight: 52 },
  tabIcon: { width: 54, height: 30, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: colors.mintSoft },
  tabDot: {
    position: 'absolute',
    top: 3,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accentBright,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  tabText: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
});
