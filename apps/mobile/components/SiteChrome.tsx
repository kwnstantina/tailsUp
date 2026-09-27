// =============================================================================
// SiteChrome — the public site header/nav + footer
//
// Sticky top nav (web): the logo mark + wordmark, the five page links, the
// orange CTA pill and the EL/EN toggle. Deep-green footer with the practice
// name and clearly-marked placeholder contact details (no fake-real values,
// per the user decision). Wraps the page <Slot/>.
//
// In the playful direction the header is a floating cream bar rather than a
// ruled one — a hairline under a cream page reads as a seam, so the separation
// comes from a soft shadow on web and the mint pill on the active link. The
// footer takes a 40px top radius, which is why the page background shows in its
// corners; that is deliberate, not a gap.
//
// Visible focus on every link via Pressable's `focused` branch (quality floor).
// =============================================================================

import { Link, usePathname } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontFallback, layout, radii, space, type, useResponsive } from '../lib/theme';
import { LanguageToggle, useLang, type Lang } from '../lib/i18n';
import { LogoMark, LogoMarkOnDark, Paw } from './ui';
import { practice } from '../lib/site-content';

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

const CTA = { el: 'Πρώτη γνωριμία', en: 'Book a first hello' } as const;

const FOOTER = {
  el: {
    tagline: 'Ήρεμη εκπαίδευση σκύλων, χωρίς εκφοβισμό — και με πρόοδο που φαίνεται.',
    contact: 'Επικοινωνία',
    hours: 'Ώρες',
    rights: 'Με επιφύλαξη παντός δικαιώματος.',
    madeWith: 'Φτιαγμένο για σκύλους που τα πάνε καλύτερα απ’ όσο νομίζουν.',
  },
  en: {
    tagline: 'Calm, force-free dog training — with progress you can actually see.',
    contact: 'Contact',
    hours: 'Hours',
    rights: 'All rights reserved.',
    madeWith: 'Made for dogs who are doing better than they think.',
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
        // The soft shadow replaces the hairline — see the header note.
        Platform.select({
          web: {
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 1px 0 rgba(43,58,49,0.06), 0 6px 18px -14px rgba(43,58,49,0.5)',
          } as object,
          default: {},
        }),
      ]}
    >
      <View style={styles.headerInner}>
        <Link href="/" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ focused }) => [styles.brandPress, focused && styles.focusedRing]}
          >
            <LogoMark size={32} />
            <Text style={[styles.brand, fontFallback.display]}>{practice.name}</Text>
          </Pressable>
        </Link>

        {isWide ? (
          <View style={styles.navRow}>
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} lang={lang} active={pathname === item.href} />
            ))}
            <CtaPill lang={lang} />
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
              <CtaPill lang={lang} />
            </ScrollView>
            <LanguageToggle />
          </View>
        )}
      </View>
    </View>
  );
}

function CtaPill({ lang }: { lang: Lang }) {
  return (
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
          active && styles.navLinkActive,
          (hovered || pressed) && !active && styles.navLinkHover,
          focused && styles.focusedRing,
          Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
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
          <View style={styles.footerBrandRow}>
            <LogoMarkOnDark size={34} />
            <Text style={[styles.footerBrand, fontFallback.display]}>{practice.name}</Text>
          </View>
          <Text style={[styles.footerTagline, fontFallback.body]}>{f.tagline}</Text>
        </View>

        <View style={styles.footerLinkCol}>
          <Text style={[styles.footerHeading, fontFallback.body]}>{f.contact}</Text>
          <Text style={[styles.footerLine, fontFallback.body]}>{practice.address[lang]}</Text>
          <Text style={[styles.footerLine, fontFallback.body]}>{practice.phone}</Text>
          <Text style={[styles.footerLine, fontFallback.body]}>{practice.email}</Text>
        </View>

        <View style={styles.footerLinkCol}>
          <Text style={[styles.footerHeading, fontFallback.body]}>{f.hours}</Text>
          <Text style={[styles.footerLine, fontFallback.body]}>{practice.hours[lang]}</Text>
        </View>
      </View>

      <View style={styles.footerBottom}>
        <View style={styles.footerBottomRow}>
          <Paw size={18} color={colors.accentSoft} />
          <Text style={[styles.footerSmall, fontFallback.body]}>{f.madeWith}</Text>
        </View>
        <Text style={[styles.footerSmall, fontFallback.body]}>
          © {practice.name} · {f.rights}
        </Text>
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

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: colors.bg,
  },
  headerInner: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    flexWrap: 'wrap',
  },
  brandPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radii.base,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    letterSpacing: -0.4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    gap: 6,
    paddingRight: space.sm,
  },
  navLink: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  navLinkHover: {
    backgroundColor: colors.mintSoft,
  },
  navLinkActive: {
    backgroundColor: colors.mintSoft,
  },
  navText: {
    ...type.body,
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
  },
  navTextActive: {
    color: colors.primary,
  },

  // The header CTA is the same contract as PrimaryButton: bright orange fill,
  // DARK label (5.1:1). Off-white on this orange is 2.0:1 and fails.
  cta: {
    backgroundColor: colors.accentBright,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    marginLeft: 4,
  },
  ctaHover: {
    backgroundColor: '#DE8330',
  },
  ctaText: {
    ...type.body,
    color: colors.text,
    fontFamily: fonts.bodyBold,
  },
  focusedRing: {
    borderColor: colors.accent,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: colors.primarySoft,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    marginTop: 'auto',
    // The page background shows in these corners on purpose.
    borderTopLeftRadius: radii.band,
    borderTopRightRadius: radii.band,
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
    maxWidth: 380,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerLinkCol: {
    gap: 6,
  },
  footerBrand: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.onDark,
    letterSpacing: -0.5,
  },
  footerTagline: {
    ...type.body,
    color: colors.onDarkMuted,
  },
  footerHeading: {
    ...type.eyebrow,
    color: colors.accentSoft,
    marginBottom: 2,
  },
  footerLine: {
    ...type.body,
    color: colors.onDark,
  },
  footerBottom: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,252,245,0.2)',
    gap: 6,
  },
  footerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  footerSmall: {
    ...type.caption,
    color: colors.onDarkFaint,
  },
});
