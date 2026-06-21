// Type surface for the platform-split PracticeMap (`.web.tsx` / `.native.tsx`).
// Metro picks the right implementation per target at bundle time; this ambient
// declaration gives `tsc` a single type for the bare `./PracticeMap` import
// (TS with moduleResolution "bundler" does not resolve platform extensions).
import type { ReactElement } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface PracticeMapProps {
  lat?: number;
  lon?: number;
  label?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export declare function PracticeMap(props: PracticeMapProps): ReactElement;
