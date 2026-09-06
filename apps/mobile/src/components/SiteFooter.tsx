// The dark footer. Carries the practice blurb, the three link groups and the
// contact details, all sourced from src/content/site.ts.

import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { colors, fonts, layout, space } from '../design/tokens';
import { useBreakpoint } from '../design/useBreakpoint';
import { contactDetails, practice } from '../content/site';
import { LogoMarkOnDark } from './Icons';
import { Body, EyebrowText, Label, Small } from './Type';

interface FooterLink {
  label: string;
  href?: Href;
}

const GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Practice',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Services', href: '/services' },
      { label: 'Results', href: '/results' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Book a session', href: '/booking' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];

function FooterLinkRow({ link }: { link: FooterLink }) {
  if (!link.href) {
    return <Body color={colors.onDarkMuted}>{link.label}</Body>;
  }
  return (
    <Link href={link.href} asChild>
      <Pressable accessibilityRole="link" style={{ minHeight: 32, justifyContent: 'center' }}>
        <Body color={colors.onDarkMuted}>{link.label}</Body>
      </Pressable>
    </Link>
  );
}

export function SiteFooter() {
  const r = useBreakpoint();

  return (
    <View style={{ backgroundColor: colors.primaryDeep }}>
      <View
        style={{
          width: '100%',
          maxWidth: layout.maxWidth,
          alignSelf: 'center',
          paddingHorizontal: r.gutter,
          paddingTop: r.isPhone ? space.lg : space.xl,
          paddingBottom: space.md,
          flexDirection: r.isPhone ? 'column' : 'row',
          gap: r.isPhone ? space.lg : space.lg,
        }}
      >
        <View style={{ gap: 14, flex: r.isPhone ? undefined : 1.4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <LogoMarkOnDark size={34} />
            <Label
              color={colors.onDark}
              style={{ fontFamily: fonts.displaySemiBold, fontSize: 25 }}
            >
              {practice.name}
            </Label>
          </View>
          <Body color={colors.onDarkFaint} style={{ maxWidth: 280 }}>
            {practice.blurb}
          </Body>
        </View>

        {GROUPS.map((group) => (
          <View key={group.title} style={{ gap: 10, flex: r.isPhone ? undefined : 1 }}>
            <EyebrowText color={colors.highlight}>{group.title}</EyebrowText>
            {group.links.map((link) => (
              <FooterLinkRow key={link.label} link={link} />
            ))}
          </View>
        ))}

        <View style={{ gap: 10, flex: r.isPhone ? undefined : 1 }}>
          <EyebrowText color={colors.highlight}>Reach us</EyebrowText>
          <Body color={colors.onDarkMuted}>{contactDetails.email}</Body>
          <Body color={colors.onDarkMuted}>{contactDetails.phone}</Body>
          <Body color={colors.onDarkMuted}>{contactDetails.addressLine1}</Body>
        </View>
      </View>

      <View
        style={{
          width: '100%',
          maxWidth: layout.maxWidth,
          alignSelf: 'center',
          paddingHorizontal: r.gutter,
          paddingTop: space.md,
          paddingBottom: space.lg,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,252,245,0.14)',
          flexDirection: r.isPhone ? 'column' : 'row',
          alignItems: r.isPhone ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Small color={colors.onDarkFaint}>
          {`© ${practice.since} ${practice.name}. All rights reserved.`}
        </Small>
        <Small color={colors.onDarkFaint}>Privacy · Terms</Small>
      </View>
    </View>
  );
}
