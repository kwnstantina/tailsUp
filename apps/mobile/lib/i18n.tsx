// =============================================================================
// Lightweight bilingual system (Greek + English) — USER DECISION OVERRIDE
//
// The design's D-4 default was Greek-first; the user chose BILINGUAL with a
// toggle. This is a dependency-free React context (NO i18n library):
//   - `Lang` = 'el' | 'en'  (default 'el')
//   - <LanguageProvider> holds the current lang; persists to localStorage on
//     web (best-effort), in-memory on native.
//   - useLang() → { lang, setLang, toggle }
//
// The per-page pattern: each page holds a `copy = { el: {...}, en: {...} }`
// object and reads `copy[lang]`. Copy LIVES IN THE PAGES (Unit C2), not here.
// `localized()` is a tiny convenience for picking a value out of such a record.
// =============================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from './theme';

export type Lang = 'el' | 'en';

const DEFAULT_LANG: Lang = 'el';
const STORAGE_KEY = 'tailsup.lang';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// Best-effort web localStorage read. Returns undefined on native / SSR / errors.
function readStoredLang(): Lang | undefined {
  if (Platform.OS !== 'web') return undefined;
  try {
    // `localStorage` is unavailable during static export (Node) — guard it.
    if (typeof localStorage === 'undefined') return undefined;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'el' || stored === 'en' ? stored : undefined;
  } catch {
    return undefined;
  }
}

function persistLang(lang: Lang): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Private mode / quota / disabled storage — in-memory state still holds.
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Start from the default so the first server/static render is deterministic
  // ('el'); hydrate from storage after mount to avoid an SSR/client mismatch.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const stored = readStoredLang();
    if (stored && stored !== lang) setLangState(stored);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    persistLang(next);
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === 'el' ? 'en' : 'el';
      persistLang(next);
      return next;
    });
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({ lang, setLang, toggle }), [lang, setLang, toggle]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * Read the current language and the setters. Throws if used outside a
 * <LanguageProvider> (which the root layout always provides).
 */
export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within a <LanguageProvider>');
  return ctx;
}

/**
 * Tiny helper to pick a value out of a `{ el, en }` record for the active lang.
 * Pages can use it for one-off bilingual strings; full page copy still lives as
 * a `copy[lang]` object in the page itself.
 */
export function localized<T>(record: Record<Lang, T>, lang: Lang): T {
  return record[lang];
}

// ── LanguageToggle — the EL/EN switch placed in the site nav ──────────────────
export function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <View
      style={styles.group}
      accessibilityRole="radiogroup"
      accessibilityLabel={lang === 'el' ? 'Επιλογή γλώσσας' : 'Language'}
    >
      <LangOption code="el" label="EL" active={lang === 'el'} onPress={() => setLang('el')} />
      <View style={styles.divider} />
      <LangOption code="en" label="EN" active={lang === 'en'} onPress={() => setLang('en')} />
    </View>
  );
}

function LangOption({
  code,
  label,
  active,
  onPress,
}: {
  code: Lang;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={code === 'el' ? 'Ελληνικά' : 'English'}
      onPress={onPress}
      style={({ hovered, focused, pressed }) => [
        styles.option,
        (hovered || pressed) && !active && styles.optionHover,
        focused && styles.optionFocused,
        Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
      ]}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.base,
    overflow: 'hidden',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  option: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  optionHover: {
    backgroundColor: colors.border,
  },
  optionFocused: {
    borderWidth: 2,
    borderColor: colors.accent,
    margin: -1,
  },
  optionText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  optionTextActive: {
    color: colors.primary,
  },
});
