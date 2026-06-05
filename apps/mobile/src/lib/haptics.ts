import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

let reduceMotionCache = false;

AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotionCache = v;
  })
  .catch(() => {});

AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
  reduceMotionCache = v;
});

/** Light impact for primary confirmations — skipped when reduced motion is on. */
export async function hapticLight(): Promise<void> {
  if (reduceMotionCache) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics unavailable on some devices/simulators.
  }
}
