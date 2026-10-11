// =============================================================================
// AppKit — the authed app's building blocks.
//
// The public site composes big marketing primitives (components/ui); the app
// needs denser, task-shaped ones: a button that carries an icon, a status pill,
// an initials avatar, a card, and the three states every data screen has
// (loading / error / empty). Same tokens as the site, so the app reads as the
// same brand — cream ground, green trust, orange for the one main action.
// =============================================================================

import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFallback, fonts, radii } from '../../lib/theme';
import { IconAlert } from './AppIcons';

const webCursor = (enabled: boolean) =>
  Platform.select({ web: { cursor: enabled ? 'pointer' : 'default' } as object, default: {} });

// ── Text ─────────────────────────────────────────────────────────────────────

export function Title({ children, size = 'lg' }: { children: ReactNode; size?: 'lg' | 'md' | 'sm' }) {
  const fontSize = size === 'lg' ? 32 : size === 'md' ? 22 : 19;
  return (
    <Text
      accessibilityRole="header"
      style={[styles.title, fontFallback.display, { fontSize, lineHeight: Math.round(fontSize * 1.2) }]}
    >
      {children}
    </Text>
  );
}

export function Eyebrow({ children, color = colors.accent }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, fontFallback.body, { color }]}>{children}</Text>;
}

export function Muted({ children, size = 15 }: { children: ReactNode; size?: number }) {
  return (
    <Text style={[styles.muted, fontFallback.body, { fontSize: size, lineHeight: Math.round(size * 1.5) }]}>
      {children}
    </Text>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'green';

const VARIANTS: Record<ButtonVariant, { bg: string; hover: string; fg: string; border: string }> = {
  // The one main action on a screen — orange fill, DARK label (5.1:1).
  primary: { bg: colors.accentBright, hover: '#DE8330', fg: colors.text, border: colors.accentBright },
  green: { bg: colors.primary, hover: colors.primarySoft, fg: colors.onDark, border: colors.primary },
  secondary: { bg: colors.surface, hover: colors.mintSoft, fg: colors.primarySoft, border: colors.primary },
  quiet: { bg: 'transparent', hover: colors.bgAlt, fg: colors.textMuted, border: 'transparent' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  block = false,
  size = 'md',
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  size?: 'md' | 'lg';
  accessibilityLabel?: string;
}) {
  const v = VARIANTS[variant];
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ hovered, pressed, focused }) => [
        styles.button,
        {
          backgroundColor: hovered || pressed ? v.hover : v.bg,
          borderColor: v.border,
          minHeight: size === 'lg' ? 56 : 46,
          paddingHorizontal: size === 'lg' ? 26 : 20,
          alignSelf: block ? 'stretch' : 'flex-start',
        },
        focused && styles.focusRing,
        blocked && styles.blocked,
        webCursor(!blocked),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonLabel, fontFallback.body, { color: v.fg, fontSize: size === 'lg' ? 17 : 15.5 }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** A round, icon-only button. Always pass an accessibilityLabel. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'light',
  size = 44,
  disabled = false,
}: {
  icon: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  tone?: 'light' | 'outline' | 'onDark';
  size?: number;
  disabled?: boolean;
}) {
  const bg = tone === 'onDark' ? 'rgba(255,252,245,0.92)' : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed, focused }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          backgroundColor: hovered || pressed ? colors.bgAlt : bg,
          borderColor: tone === 'outline' ? colors.fieldBorder : 'transparent',
        },
        focused && styles.focusRing,
        disabled && styles.blocked,
        webCursor(!disabled),
      ]}
    >
      {icon}
    </Pressable>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Panel({
  children,
  style,
  tint,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: 'peach' | 'mint' | 'coral' | 'cream';
}) {
  const tintStyle =
    tint === 'peach'
      ? { backgroundColor: colors.accentPeach, borderColor: colors.accentPeach }
      : tint === 'mint'
        ? { backgroundColor: colors.mintSoft, borderColor: colors.mintSoft }
        : tint === 'coral'
          ? { backgroundColor: colors.coralSoft, borderColor: colors.coralSoft }
          : tint === 'cream'
            ? { backgroundColor: colors.bgAlt, borderColor: colors.bgAlt }
            : null;
  return <View style={[styles.panel, tintStyle, style]}>{children}</View>;
}

export type PillTone = 'mint' | 'peach' | 'coral' | 'neutral';

const PILL: Record<PillTone, { bg: string; fg: string }> = {
  mint: { bg: colors.mintSoft, fg: colors.primarySoft },
  peach: { bg: colors.accentPeach, fg: colors.textOnPeach },
  coral: { bg: colors.coralSoft, fg: colors.textOnCoral },
  neutral: { bg: '#F3ECDF', fg: colors.textMuted },
};

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const p = PILL[tone];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <Text style={[styles.pillText, fontFallback.body, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

/** Orange count badge for nav items. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.countBadge}>
      <Text style={[styles.countBadgeText, fontFallback.body]}>{count}</Text>
    </View>
  );
}

const AVATAR_TINTS = [colors.accentPeach, colors.mintSoft, colors.coralSoft, colors.bgAlt] as const;
const AVATAR_INK = [colors.textOnPeach, colors.textOnMint, colors.textOnCoral, colors.textOnPeach] as const;

/** Initials on a brand tint picked from the name, so a dog keeps its colour. */
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const i = hash % AVATAR_TINTS.length;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { width: size, height: size, backgroundColor: AVATAR_TINTS[i] }]}
    >
      <Text
        style={[
          styles.avatarText,
          fontFallback.display,
          { color: AVATAR_INK[i], fontSize: Math.round(size * 0.38) },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

// ── Screen scaffolding ───────────────────────────────────────────────────────

/** Scrollable page body with the app's max width and gutters. */
export function Screen({
  children,
  maxWidth = 1040,
  padTop = 28,
}: {
  children: ReactNode;
  maxWidth?: number;
  padTop?: number;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.screen, { paddingTop: padTop }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.screenInner, { maxWidth }]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Title size="md">{title}</Title>
      {action}
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.primary} />
      <Muted>{label}</Muted>
    </View>
  );
}

export function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <Panel tint="coral" style={styles.errorPanel}>
      <View style={styles.row}>
        <IconAlert color={colors.danger} />
        <Text style={[styles.errorTitle, fontFallback.body]}>{title}</Text>
      </View>
      <Text style={[styles.errorBody, fontFallback.body]}>{message}</Text>
      <Button label={retryLabel} variant="secondary" onPress={onRetry} />
    </Panel>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Muted>{message}</Muted>
      {action}
    </View>
  );
}

/** Inline notice — success (mint), error (coral) or info (peach). */
export function Notice({ tone, children }: { tone: 'success' | 'error' | 'info'; children: ReactNode }) {
  const tint = tone === 'success' ? 'mint' : tone === 'error' ? 'coral' : 'peach';
  const ink = tone === 'success' ? colors.textOnMint : tone === 'error' ? colors.textOnCoral : colors.textOnPeach;
  return (
    <Panel tint={tint} style={styles.notice}>
      <Text
        accessibilityRole={tone === 'error' ? 'alert' : undefined}
        style={[styles.noticeText, fontFallback.body, { color: ink }]}
      >
        {children}
      </Text>
    </Panel>
  );
}

export const appStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stack: { gap: 12 },
});

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, color: colors.text },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  muted: { fontFamily: fonts.body, color: colors.textMuted },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  buttonLabel: { fontFamily: fonts.bodyBold },
  iconButton: {
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusRing: { outlineColor: colors.accent, outlineWidth: 2, outlineStyle: 'solid' } as ViewStyle,
  blocked: { opacity: 0.55 },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.fieldBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  pill: { alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.accentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  avatar: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display },
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { paddingHorizontal: 16, paddingBottom: 48, alignItems: 'center' },
  screenInner: { width: '100%', gap: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorPanel: { gap: 10 },
  errorTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.textOnCoral },
  errorBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textOnCoral },
  empty: {
    gap: 12,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.fieldBorder,
    alignItems: 'flex-start',
  },
  notice: { paddingVertical: 12, paddingHorizontal: 14 },
  noticeText: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 22 },
});
