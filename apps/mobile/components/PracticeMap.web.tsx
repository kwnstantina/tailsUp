// =============================================================================
// PracticeMap (WEB) — keyless OpenStreetMap embed (DS / D-3, Topic 5)
//
// A no-key, no-cost OSM `export/embed.html` <iframe>. Metro picks this file on
// web; the `.native.tsx` sibling (card + Linking) is used on iOS/Android, so the
// <iframe> (an unknown element to RN's type system) never enters the native
// bundle. Coords are a GENERIC Athens placeholder (D-9 / user decision) — no
// real address baked in.
// =============================================================================

import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from '../lib/theme';

// Generic Athens pin (placeholder — replace with the real practice coords).
const LAT = 37.9838;
const LON = 23.7275;

export interface PracticeMapProps {
  lat?: number;
  lon?: number;
  label?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function PracticeMap({ lat = LAT, lon = LON, label, height = 320, style }: PracticeMapProps) {
  const bbox = `${lon - 0.012},${lat - 0.007},${lon + 0.012},${lat + 0.007}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${lat},${lon}`;

  return (
    <View
      style={[
        { width: '100%', height, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {/* Plain DOM iframe — web only. react-native-web renders <View> as a div,
          so a raw <iframe> child is valid here. */}
      <iframe
        src={src}
        title={label ?? 'TailsUp — practice location'}
        loading="lazy"
        style={{ border: 0, width: '100%', height: '100%' }}
      />
    </View>
  );
}
