// The site's top bar. Full nav on desktop, a disclosure menu below 900px.

import { useState } from 'react';
import { Link, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { colors, fonts, layout, radii, space } from '../design/tokens';
import { useBreakpoint } from '../design/useBreakpoint';
import { IconClose, IconMenu, LogoMark } from './Icons';
import { Label } from './Type';
import { Button } from './Ui';

interface NavItem {
  href: Href;
  label: string;
}

const NAV: NavItem[] = [
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/results', label: 'Results' },
  { href: '/contact', label: 'Contact' },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Label
          color={active ? colors.primary : colors.text}
          style={{ fontSize: 16, fontFamily: active ? fonts.bodyBold : fonts.bodySemiBold }}
        >
          {item.label}
        </Label>
        {active ? (
          <View
            style={{
              height: 3,
              borderRadius: 999,
              backgroundColor: colors.accent,
              marginTop: 3,
            }}
          />
        ) : null}
      </Pressable>
    </Link>
  );
}

export function SiteHeader() {
  const r = useBreakpoint();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: Href) => pathname === href;

  return (
    <View style={{ backgroundColor: colors.bg }}>
      <View
        style={{
          width: '100%',
          maxWidth: layout.maxWidth,
          alignSelf: 'center',
          paddingHorizontal: r.gutter,
          height: r.isPhone ? 68 : 92,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.lg,
        }}
      >
        <Link href="/" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="TailsUp — home"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 44 }}
          >
            <LogoMark size={r.isPhone ? 30 : 34} />
            <Label
              style={{
                fontFamily: fonts.displaySemiBold,
                fontSize: r.isPhone ? 22 : 25,
              }}
              color={colors.primary}
            >
              TailsUp
            </Label>
          </Pressable>
        </Link>

        {/*
          Both clusters always render and `display` picks one, rather than a
          conditional that swaps them. The static web export pre-renders at the
          desktop width, so a conditional would hand a phone visitor a DOM tree
          that differs structurally from the HTML they were served — React can
          only recover from that by throwing the subtree away and re-rendering.
          A style difference hydrates cleanly.
        */}
        <View
          style={{
            display: r.isPhone ? 'none' : 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 26,
            marginLeft: 'auto',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 30 }}>
            {NAV.map((item) => (
              <NavLink key={item.label} item={item} active={isActive(item.href)} />
            ))}
          </View>
          <Button label="Book a session" href="/booking" size="small" />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close menu' : 'Open menu'}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((v) => !v)}
          style={{
            display: r.isPhone ? 'flex' : 'none',
            marginLeft: 'auto',
            width: 46,
            height: 46,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: -10,
          }}
        >
          {open ? <IconClose /> : <IconMenu />}
        </Pressable>
      </View>

      {r.isPhone && open ? (
        <View
          style={{
            paddingHorizontal: r.gutter,
            paddingBottom: space.md,
            gap: 4,
            backgroundColor: colors.bg,
            borderBottomWidth: 1,
            borderBottomColor: colors.fieldBorder,
          }}
        >
          {NAV.map((item) => (
            <Link key={item.label} href={item.href} asChild>
              <Pressable
                accessibilityRole="link"
                onPress={() => setOpen(false)}
                style={({ pressed }) => ({
                  minHeight: 52,
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                  borderRadius: radii.field,
                  backgroundColor: pressed ? colors.bgAlt : 'transparent',
                })}
              >
                <Label
                  color={isActive(item.href) ? colors.primary : colors.text}
                  style={{ fontSize: 17 }}
                >
                  {item.label}
                </Label>
              </Pressable>
            </Link>
          ))}
          <Button
            label="Book a session"
            href="/booking"
            block
            style={{ marginTop: space.xs }}
            onPress={() => setOpen(false)}
          />
        </View>
      ) : null}
    </View>
  );
}
