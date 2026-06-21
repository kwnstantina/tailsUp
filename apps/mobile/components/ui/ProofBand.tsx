// =============================================================================
// ProofBand — the single dark deep-green band (DS-4.6, used ONCE per page)
//
// The one bold/dark moment per page ("spend boldness in one place"). Deep-green
// background, off-white text; headings inside still use Fraunces. Holds a proof
// statement, a key stat, or a strong CTA — not decoration. Copper only as a
// small accent inside, never a copper fill.
// =============================================================================

import { Section } from './Section';

export function ProofBand({
  children,
  prose = false,
  maxWidth,
}: {
  children: React.ReactNode;
  prose?: boolean;
  maxWidth?: number;
}) {
  return (
    <Section dark prose={prose} maxWidth={maxWidth}>
      {children}
    </Section>
  );
}
