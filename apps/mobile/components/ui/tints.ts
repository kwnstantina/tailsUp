// =============================================================================
// Tints — the rotating card fills of the playful direction
//
// Cards, stickers and photo slots pick one of five tints rather than all being
// white. Each entry carries its own INK, because contrast has to be checked
// against the tint, not against the page background — `colors.textMuted` is
// 5.1:1 on cream but drops below AA on the coral wash.
//
//   bg      the fill
//   ink     body copy on that fill (>= 7:1, all five)
//   iconInk the stroked-icon colour inside the tint's IconBubble
//
// Rotate them in source order so a row of three never repeats.
// =============================================================================

import { colors } from '../../lib/theme';

export type Tint = 'mint' | 'peach' | 'coral' | 'white' | 'highlight';

export const TINTS: Record<Tint, { bg: string; ink: string; iconInk: string }> = {
  mint: { bg: colors.mintSoft, ink: colors.textOnMint, iconInk: colors.primary },
  peach: { bg: colors.accentPeach, ink: colors.textOnPeach, iconInk: colors.accent },
  coral: { bg: colors.coralSoft, ink: colors.textOnCoral, iconInk: colors.danger },
  white: { bg: colors.surface, ink: colors.textMuted, iconInk: colors.primary },
  highlight: { bg: colors.highlight, ink: colors.textOnPeach, iconInk: colors.accent },
};

/** Three-tint rotation for card grids — mint, peach, coral, repeating. */
export const CARD_TINTS: Tint[] = ['mint', 'peach', 'coral'];

/** The tint for position `i` in a grid, wrapping at the end of the rotation. */
export function tintAt(i: number): Tint {
  return CARD_TINTS[i % CARD_TINTS.length];
}
