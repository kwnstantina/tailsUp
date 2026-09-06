// The signature element: threshold-over-time.
//
// This is the one piece of the site that is proof rather than decoration — it
// is the visible face of the BehaviorEvent dataset (trigger, threshold,
// intensity, outcome) that the whole product is built around. It renders from
// an array of metre readings, one per week, so the same component will drive a
// real client's curve once the dashboard exists.
//
// Everywhere it appears with demo numbers it is captioned as sample data.

import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { View } from 'react-native';
import { colors, fonts } from '../design/tokens';

// Drawing space. Everything below is in these units and scales with the frame.
const VB_W = 460;
const VB_H = 250;
const PLOT_LEFT = 44;
const PLOT_RIGHT = 440;
const BASELINE = 200; // y for 0 m
const TOP = 35; // y for yMax
const Y_MAX = 15; // metres at the top gridline

const yFor = (metres: number) => BASELINE - (metres / Y_MAX) * (BASELINE - TOP);
const xFor = (index: number, count: number) =>
  count <= 1 ? PLOT_LEFT : PLOT_LEFT + (index * (PLOT_RIGHT - PLOT_LEFT)) / (count - 1);

interface ProgressCurveProps {
  /** Threshold distance in metres, one reading per week. */
  data: number[];
  /** `light` sits on a white card, `dark` sits directly on the green band. */
  variant?: 'light' | 'dark';
  accent?: string;
}

export function ProgressCurve({
  data,
  variant = 'light',
  accent = colors.accent,
}: ProgressCurveProps) {
  const onDark = variant === 'dark';
  const gridColor = onDark ? colors.onDark : colors.text;
  const gridOpacity = onDark ? 0.1 : 0.1;
  const labelColor = onDark ? colors.onDarkFaint : colors.textMuted;
  const dotRing = onDark ? colors.primaryDeep : colors.bg;

  const points = data.map((value, i) => `${xFor(i, data.length)} ${yFor(value)}`);
  const line = `M${points.join(' ')}`;
  const area = `${line} ${PLOT_RIGHT} ${BASELINE} ${PLOT_LEFT} ${BASELINE}Z`;

  // Mark the first, middle and last readings only — a dot per week turns the
  // line into noise at this size.
  const marked = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const lastIndex = data.length - 1;

  return (
    <View
      style={{ width: '100%', aspectRatio: VB_W / VB_H }}
      accessible
      accessibilityLabel={`Progress curve: threshold distance rising from ${data[0]} to ${data[lastIndex]} metres over ${data.length} weeks.`}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <LinearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity={0.3} />
            <Stop offset="1" stopColor={accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {[0, 5, 10, 15].map((metres) => (
          <Path
            key={metres}
            d={`M${PLOT_LEFT} ${yFor(metres)}H${PLOT_RIGHT}`}
            stroke={gridColor}
            strokeOpacity={gridOpacity}
            strokeWidth={1.5}
          />
        ))}

        {[0, 5, 10, 15].map((metres) => (
          <SvgText
            key={`label-${metres}`}
            x={PLOT_LEFT - 10}
            y={yFor(metres) + 4}
            textAnchor="end"
            fill={labelColor}
            fontSize={12.5}
            fontFamily={fonts.bodySemiBold}
          >
            {`${metres} m`}
          </SvgText>
        ))}

        <Path d={area} fill="url(#curveFill)" />
        <Path
          d={line}
          stroke={accent}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {marked.map((i) =>
          i === lastIndex ? null : (
            <Circle key={i} cx={xFor(i, data.length)} cy={yFor(data[i])} r={4} fill={accent} />
          ),
        )}
        <Circle
          cx={xFor(lastIndex, data.length)}
          cy={yFor(data[lastIndex])}
          r={7}
          fill={accent}
          stroke={dotRing}
          strokeWidth={3.5}
        />

        <SvgText
          x={PLOT_LEFT}
          y={BASELINE + 28}
          fill={labelColor}
          fontSize={12.5}
          fontFamily={fonts.bodySemiBold}
        >
          Week 1
        </SvgText>
        <SvgText
          x={PLOT_RIGHT}
          y={BASELINE + 28}
          textAnchor="end"
          fill={labelColor}
          fontSize={12.5}
          fontFamily={fonts.bodySemiBold}
        >
          {`Week ${data.length}`}
        </SvgText>
      </Svg>
    </View>
  );
}
