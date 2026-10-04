// =============================================================================
// PracticeMap (WEB) — keyless OpenStreetMap embed (DS / D-3, Topic 5)
//
// A no-key, no-cost OSM `export/embed.html` <iframe>. Metro picks this file on
// web; the `.native.tsx` sibling (card + Linking) is used on iOS/Android, so the
// <iframe> (an unknown element to RN's type system) never enters the native
// bundle. The pin comes from `practice.coords` so the map and the footer can
// never drift apart.
// =============================================================================

import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from '../lib/theme';
import { practice } from '../lib/site-content';

const { lat: LAT, lon: LON } = practice.coords;

// Half-width of the viewport around the pin, in degrees — about 2.2km across at
// this latitude. Wider than a street-level frame on purpose: the site gives a
// town, not an address, so a tight box would imply a precision it does not have.
const SPAN_LON = 0.025;
const SPAN_LAT = 0.014;

export interface PracticeMapProps {
  lat?: number;
  lon?: number;
  label?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function PracticeMap({ lat = LAT, lon = LON, label, height = 320, style }: PracticeMapProps) {
  // Fixed to 4dp (~11m) so float arithmetic cannot put `37.988200000000006`
  // in the URL — harmless, but it shows up in the DOM and in bug reports.
  const d = (n: number) => n.toFixed(4);
  const bbox = `${d(lon - SPAN_LON)},${d(lat - SPAN_LAT)},${d(lon + SPAN_LON)},${d(lat + SPAN_LAT)}`;
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
