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

/** Medium impact for higher-weight actions (approve/reject, delete). */
export async function hapticMedium(): Promise<void> {
  if (reduceMotionCache) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Haptics unavailable on some devices/simulators.
  }
}

/** Success notification — payment confirmed, action completed. */
export async function hapticSuccess(): Promise<void> {
  if (reduceMotionCache) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics unavailable on some devices/simulators.
  }
}

/** Error notification — action failed, validation error. */
export async function hapticError(): Promise<void> {
  if (reduceMotionCache) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Haptics unavailable on some devices/simulators.
  }
}

/** Very light tick for selection changes (segmented controls, chips, sliders). */
export async function hapticSelection(): Promise<void> {
  if (reduceMotionCache) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Haptics unavailable on some devices/simulators.
  }
}
