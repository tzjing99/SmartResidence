import * as React from 'react';
import { AccessibilityInfo } from 'react-native';

/** Mirrors web `prefers-reduced-motion` for React Native. */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
