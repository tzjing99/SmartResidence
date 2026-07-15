import type { DeliveryPlatform, Visitor, VisitorPassKind } from '@smartresidence/shared-types';

type QuickPassKind = Exclude<VisitorPassKind, 'STANDARD'>;

export type QuickPassRecommendation = {
  passKind: QuickPassKind;
  platform: DeliveryPlatform;
  sampleSize: number;
  personalized: boolean;
};

const DEFAULT_RECOMMENDATION: QuickPassRecommendation = {
  passKind: 'DELIVERY',
  platform: 'GRABFOOD',
  sampleSize: 0,
  personalized: false,
};

/**
 * Recommend the most frequently used quick-pass pair. Input is expected in
 * newest-first order, so the first occurrence wins frequency ties.
 */
export function recommendQuickPass(
  history: Array<Pick<Visitor, 'passKind' | 'deliveryPlatform'>>,
): QuickPassRecommendation {
  const quickPasses = history.filter(
    (
      visitor,
    ): visitor is Pick<Visitor, 'passKind' | 'deliveryPlatform'> & {
      passKind: QuickPassKind;
      deliveryPlatform: DeliveryPlatform;
    } =>
      (visitor.passKind === 'DELIVERY' || visitor.passKind === 'E_HAILING') &&
      Boolean(visitor.deliveryPlatform),
  );

  if (quickPasses.length < 2) {
    return { ...DEFAULT_RECOMMENDATION, sampleSize: quickPasses.length };
  }

  const counts = new Map<
    string,
    { count: number; passKind: QuickPassKind; platform: DeliveryPlatform }
  >();
  for (const visitor of quickPasses) {
    const key = `${visitor.passKind}:${visitor.deliveryPlatform}`;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, {
        count: 1,
        passKind: visitor.passKind,
        platform: visitor.deliveryPlatform,
      });
    }
  }

  const best = [...counts.values()].reduce((winner, candidate) =>
    candidate.count > winner.count ? candidate : winner,
  );

  return {
    passKind: best.passKind,
    platform: best.platform,
    sampleSize: quickPasses.length,
    personalized: true,
  };
}
