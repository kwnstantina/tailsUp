// =============================================================================
// useReducedMotion — prefers-reduced-motion across web + native (DS-6 / NFR-1)
//
// Wraps AccessibilityInfo: on web react-native-web wires
// isReduceMotionEnabled()/'reduceMotionChanged' to the
// `(prefers-reduced-motion: reduce)` media query, so a single RN API covers both
// targets. Used by ProgressCurve (and any animated chrome) to gate motion —
// when true, render the final static state, never convey info by motion alone.
// =============================================================================

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Initial read — may resolve after first paint; default (false) is the safe
    // "motion allowed" assumption that we then correct.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Some platforms can reject; treat as "no preference".
      });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduced(value);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
