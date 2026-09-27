// =============================================================================
// ProofBand — the deep-green band, ONE per page
//
// Still the page's single bold moment, but in the playful direction it is a
// ROUNDED INSET card rather than a full-bleed stripe: a 40px-radius block of
// deep green floating on the cream, which reads as a deliberate object instead
// of a divider. `bleed` restores the old edge-to-edge band for a page that
// wants the band to close it out.
//
// Ink inside is `colors.onDark` (8.9:1) with `onDarkMuted` for secondary copy.
// The bright orange may appear here as a FILL — the CTA, the curve's line —
// never as copy.
// =============================================================================

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { colors, radii, useResponsive } from '../../lib/theme';
import { Container } from './Container';
import { Section } from './Section';

export function ProofBand({
  children,
  prose = false,
  maxWidth,
  /** Full-bleed edge-to-edge band instead of the rounded inset block. */
  bleed = false,
}: {
  children: ReactNode;
  prose?: boolean;
  maxWidth?: number;
  bleed?: boolean;
}) {
  const { isWide } = useResponsive();

  if (bleed) {
    return (
      <Section dark prose={prose} maxWidth={maxWidth}>
        {children}
      </Section>
    );
  }

  return (
    <View style={{ paddingVertical: isWide ? 40 : 28, backgroundColor: colors.bg }}>
      <Container maxWidth={maxWidth}>
        <View
          style={{
            backgroundColor: colors.primarySoft,
            borderRadius: radii.band,
            padding: isWide ? 56 : 26,
          }}
        >
          {children}
        </View>
      </Container>
    </View>
  );
}
