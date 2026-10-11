// =============================================================================
// AppIcons — the authed app's UI icons.
//
// Same house style as components/ui/Icons.tsx (24×24 grid, round caps and
// joins, stroke takes `color`), kept separate because these are navigation and
// control glyphs the public site never draws.
// =============================================================================

import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../../lib/theme';

interface IconProps {
  size?: number;
  color?: string;
}

const STROKE = 2;

function Base({ size = 20, color = colors.text, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </Base>
  );
}

export function IconDogs(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx={5} cy={9} r={2} />
      <Circle cx={9.5} cy={5} r={2} />
      <Circle cx={14.5} cy={5} r={2} />
      <Circle cx={19} cy={9} r={2} />
      <Path d="M12 12c-3 0-5.5 3-5.5 5.5 0 1.5 1 2.5 2.5 2.5 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.5 0 2.5-1 2.5-2.5C17.5 15 15 12 12 12z" />
    </Base>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <Base {...p}>
      <Rect x={3} y={4} width={18} height={17} rx={2} />
      <Path d="M8 2v4M16 2v4M3 10h18" />
    </Base>
  );
}

export function IconInbox(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4 4h16v12H8l-4 4z" />
    </Base>
  );
}

export function IconChart(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M3 3v18h18" />
      <Path d="M7 14l4-4 3 3 5-6" />
    </Base>
  );
}

export function IconChecklist(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M9 11l3 3 8-8" />
      <Path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
    </Base>
  );
}

export function IconLogout(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </Base>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function IconMinus(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M5 12h14" />
    </Base>
  );
}

export function IconBack(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M15 18l-6-6 6-6" />
    </Base>
  );
}

export function IconChevron(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M9 18l6-6-6-6" />
    </Base>
  );
}

export function IconCheckMark(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M5 12l5 5 9-10" />
    </Base>
  );
}

export function IconWave(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4 12h4l2-5 4 10 2-5h4" />
    </Base>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 8v5M12 17h.01" />
    </Base>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 16v-4M12 8h.01" />
    </Base>
  );
}

export function IconVideo(p: IconProps) {
  return (
    <Base {...p}>
      <Rect x={2} y={6} width={14} height={12} rx={2} />
      <Path d="M16 10l6-3v10l-6-3" />
    </Base>
  );
}

export function IconEye(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <Circle cx={12} cy={12} r={3} />
    </Base>
  );
}

export function IconEyeOff(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Base>
  );
}

export function IconMailOutline(p: IconProps) {
  return (
    <Base {...p}>
      <Rect x={2} y={4} width={20} height={16} rx={2} />
      <Path d="M22 6l-10 7L2 6" />
    </Base>
  );
}

export function IconPhoneOutline(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </Base>
  );
}

export function IconArchive(p: IconProps) {
  return (
    <Base {...p}>
      <Rect x={2} y={3} width={20} height={5} rx={1} />
      <Path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" />
    </Base>
  );
}
