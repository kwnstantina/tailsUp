// =============================================================================
// SiteChrome — the public site header/nav + footer (FR-W9, DS-4)
//
// Sticky top nav (web): brand + the five page links + a "Κλείσε αξιολόγηση" CTA
// + the EL/EN LanguageToggle. Deep-green footer with the practice name and
// clearly-marked placeholder contact details (brand "TailsUp"; [διεύθυνση] /
// [τηλέφωνο] / [email] / [ώρες] — no fake-real values, per the user decision).
// Nav labels are bilingual, driven by useLang(). Wraps the page <Slot/>.
//
// Visible focus on every link via Pressable's `focused` branch (quality floor).
// =============================================================================

import { Link, usePathname } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontFallback, layout, radii, space, type, useResponsive } from '../lib/theme';
import { LanguageToggle, useLang, type Lang } from '../lib/i18n';

type Href = '/' | '/about' | '/services' | '/results' | '/contact' | '/booking';

interface NavItem {
  href: Href;
  el: string;
  en: string;
}

const NAV: NavItem[] = [
  { href: '/', el: 'Αρχική', en: 'Home' },
  { href: '/about', el: 'Ποιοι είμαστε', en: 'About' },
  { href: '/services', el: 'Υπηρεσίες', en: 'Services' },
  { href: '/results', el: 'Αποτελέσματα', en: 'Results' },
  { href: '/contact', el: 'Επικοινωνία', en: 'Contact' },
];

const CTA = { el: 'Κλείσε αξιολόγηση', en: 'Book an assessment' } as const;

const FOOTER = {
  el: {
    tagline: 'Επαγγελματική, ήρεμη, μετρήσιμη εκπαίδευση σκύλων.',
    contact: 'Επικοινωνία',
    hours: 'Ώρες',
    address: '[διεύθυνση], Αθήνα',
    phone: '[τηλέφωνο]',
    email: '[email]',
    hoursValue: '[ώρες]',
    rights: 'Με επιφύλαξη παντός δικαιώματος.',
  },
  en: {
    tagline: 'Calm, professional, measurable dog training.',
    contact: 'Contact',
    hours: 'Hours',
    address: '[address], Athens',
    phone: '[phone]',
    email: '[email]',
    hoursValue: '[hours]',
    rights: 'All rights reserved.',
  },
} as const;

export function SiteChrome({ children }: { children: React.ReactNode }) {
  // Header is sticky (web); the page content + footer scroll beneath it. Each
  // page renders its own <Section>s as the Slot content; the footer always sits
  // at the bottom of the scroll (pushed down by marginTop:'auto' on short pages).
  return (
    <View style={styles.root}>
      <Header />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageWrap}>{children}</View>
        <Footer />
      </ScrollView>
    </View>
  );
}

function Header() {
  const { lang } = useLang();
  const { isWide } = useResponsive();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.header,
        // Sticky header on web (RN has no sticky; apply via Platform.select).
        Platform.select({ web: { position: 'sticky', top: 0, zIndex: 100 } as object, default: {} }),
      ]}
    >
      <View style={styles.headerInner}>
        <Link href="/" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ focused }) => [styles.brandPress, focused && styles.focusedRing]}
          >
            <Text style={[styles.brand, fontFallback.display]}>TailsUp</Text>
          </Pressable>
        </Link>

        {isWide ? (
          <View style={styles.navRow}>
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} lang={lang} active={pathname === item.href} />
            ))}
            <Link href="/booking" asChild>
              <Pressable
                accessibilityRole="link"
                style={({ hovered, focused, pressed }) => [
                  styles.cta,
                  (hovered || pressed) && styles.ctaHover,
                  focused && styles.focusedRing,
                  Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
                ]}
              >
                <Text style={[styles.ctaText, fontFallback.body]}>{CTA[lang]}</Text>
              </Pressable>
            </Link>
            <LanguageToggle />
          </View>
        ) : (
          // Narrow: horizontally-scrollable nav row + toggle on its own line.
          <View style={styles.narrowNav}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.narrowNavRow}
            >
              {NAV.map((item) => (
                <NavLink key={item.href} item={item} lang={lang} active={pathname === item.href} />
              ))}
              <Link href="/booking" asChild>
                <Pressable
                  accessibilityRole="link"
                  style={({ hovered, focused, pressed }) => [
                    styles.cta,
                    (hovered || pressed) && styles.ctaHover,
                    focused && styles.focusedRing,
                    Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
                  ]}
                >
                  <Text style={[styles.ctaText, fontFallback.body]}>{CTA[lang]}</Text>
                </Pressable>
              </Link>
            </ScrollView>
            <LanguageToggle />
          </View>
        )}
      </View>
    </View>
  );
}

function NavLink({ item, lang, active }: { item: NavItem; lang: Lang; active: boolean }) {
  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        style={({ hovered, focused, pressed }) => [
          styles.navLink,
          focused && styles.focusedRing,
          Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
          (hovered || pressed) && styles.navLinkHover,
        ]}
      >
        <Text style={[styles.navText, fontFallback.body, active && styles.navTextActive]}>
          {item[lang]}
        </Text>
      </Pressable>
    </Link>
  );
}

function Footer() {
  const { lang } = useLang();
  const f = FOOTER[lang];
  const { isWide } = useResponsive();

  return (
    <View style={styles.footer}>
      <View style={[styles.footerInner, isWide ? styles.footerRow : styles.footerCol]}>
        <View style={styles.footerBrandCol}>
          <Text style={[styles.footerBrand, fontFallback.display]}>TailsUp</Text>
          <Text style={[styles.footerTagline, fontFallback.body]}>{f.tagline}</Text>
        </View>

        <View style={styles.footerCol2}>
          <Text style={[styles.footerHeading, fontFallback.body]}>{f.contact}</Text>
          <Text style={[styles.footerLine, fontFallback.body]}>{f.address}</Text>
          <Text style={[styles.footerLine, fontFallback.body]}>{f.phone}</Text>
          <Text style={[styles.footerLine, fontFallback.body]}>{f.email}</Text>
        </View>

        <View style={styles.footerCol2}>
          <Text style={[styles.footerHeading, fontFallback.body]}>{f.hours}</Text>
          <Text style={[styles.footerLine, fontFallback.body]}>{f.hoursValue}</Text>
        </View>
      </View>
      <View style={styles.footerBottom}>
        <Text style={[styles.footerSmall, fontFallback.body]}>© TailsUp · {f.rights}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  pageWrap: {
    width: '100%',
  },

  // Header
  header: {
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerInner: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    flexWrap: 'wrap',
  },
  brandPress: {
    borderRadius: radii.base,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: -0.44,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexWrap: 'wrap',
  },
  narrowNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexShrink: 1,
  },
  narrowNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingRight: space.sm,
  },
  navLink: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.base,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  navLinkHover: {
    backgroundColor: colors.border,
  },
  navText: {
    ...type.body,
    color: colors.textMuted,
  },
  navTextActive: {
    color: colors.primary,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radii.base,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ctaHover: {
    backgroundColor: colors.primarySoft,
  },
  ctaText: {
    ...type.body,
    color: colors.bg,
  },
  focusedRing: {
    borderColor: colors.accent,
  },

  // Footer
  footer: {
    backgroundColor: colors.primary,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    marginTop: 'auto',
  },
  footerInner: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    gap: space.lg,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerCol: {
    flexDirection: 'column',
  },
  footerBrandCol: {
    gap: space.xs,
    maxWidth: 360,
  },
  footerCol2: {
    gap: 6,
  },
  footerBrand: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.bg,
    letterSpacing: -0.48,
  },
  footerTagline: {
    ...type.body,
    color: colors.accentSoft,
  },
  footerHeading: {
    ...type.eyebrow,
    color: colors.accentSoft,
    marginBottom: 2,
  },
  footerLine: {
    ...type.body,
    color: colors.bg,
  },
  footerBottom: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(250,247,240,0.2)',
  },
  footerSmall: {
    ...type.caption,
    color: colors.accentSoft,
  },
});
