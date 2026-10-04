// =============================================================================
// photos.ts — the one place a real photograph is wired into the public site
//
// Every photo slot on the site resolves its image through this map. A key whose
// value is `null` renders the marked placeholder frame instead (see Media.tsx),
// so the site is always shippable: dropping a real file in means adding ONE
// `require` here, and no page or component changes.
//
// `require` (not a string path) is deliberate — Metro has to see the literal to
// bundle the asset, and it is what makes the same key work on web and native.
//
// FILES LIVE IN `assets/photos/`, already cropped to the shape their slot uses:
// the crew circles are square (600×600, framed on each dog's head, because the
// slot is a circle and anything in the corners is lost); the hero is near-square
// (1000×954) to match its frame while keeping Ater's hind legs in shot; the
// /about photo is a landscape band (1170×880). Cropping here rather than leaning
// on `resizeMode="cover"` is what keeps a head from being sliced off at one
// breakpoint and not another.
// =============================================================================

import type { ImageSourcePropType } from 'react-native';

export type PhotoSlot =
  /** Home hero — the big peach frame beside the headline. */
  | 'heroDog'
  /** /about — a session in progress, beside the opening paragraph. */
  | 'aboutSession'
  /** /about — the trainer's portrait, in the white card. */
  | 'trainerPortrait'
  /** Home crew strip — one circle each. */
  | 'crewAter'
  | 'crewAlba'
  | 'crewNero';

/**
 * Every slot now carries a real photograph. A `null` here would still render
 * that slot's labelled placeholder rather than break the page, which is what
 * makes adding a new slot safe.
 */
export const photos: Record<PhotoSlot, ImageSourcePropType | null> = {
  heroDog: require('../assets/photos/hero-ater-walk.jpg'),
  aboutSession: require('../assets/photos/about-ater.jpg'),
  trainerPortrait: require('../assets/photos/trainer-dimitra.jpg'),
  crewAter: require('../assets/photos/crew-ater.jpg'),
  crewAlba: require('../assets/photos/crew-alba.jpg'),
  crewNero: require('../assets/photos/crew-nero.jpg'),
};
