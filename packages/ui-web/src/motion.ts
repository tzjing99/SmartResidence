import type { Transition } from 'framer-motion';

/** Shared iOS-like spring presets for web motion. */
export const iosSpring = {
  snappy: { type: 'spring', stiffness: 520, damping: 30, mass: 0.8 } satisfies Transition,
  default: { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 } satisfies Transition,
  gentle: { type: 'spring', stiffness: 320, damping: 28, mass: 1 } satisfies Transition,
};

export const tapScale = 0.98;

/** Instant press feedback — tween beats spring for sub-100ms perceived response. */
export const tapTransition = {
  type: 'tween',
  duration: 0.06,
  ease: 'easeOut',
} satisfies Transition;

/** Stagger delay for list items (cap so long lists stay snappy). */
export function listStaggerDelay(index: number, cap = 6): number {
  return Math.min(index, cap) * 0.035;
}
