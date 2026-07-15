import type { Visitor } from '@smartresidence/shared-types';
import { describe, expect, it } from 'vitest';
import { recommendQuickPass } from './quick-pass-recommendation';

type HistoryItem = Pick<Visitor, 'passKind' | 'deliveryPlatform'>;

describe('recommendQuickPass', () => {
  it('keeps safe defaults without enough usage history', () => {
    expect(recommendQuickPass([])).toEqual({
      passKind: 'DELIVERY',
      platform: 'GRABFOOD',
      sampleSize: 0,
      personalized: false,
    });

    expect(recommendQuickPass([{ passKind: 'E_HAILING', deliveryPlatform: 'GRAB' }])).toEqual({
      passKind: 'DELIVERY',
      platform: 'GRABFOOD',
      sampleSize: 1,
      personalized: false,
    });
  });

  it('recommends the most frequent quick-pass pair', () => {
    const history: HistoryItem[] = [
      { passKind: 'E_HAILING', deliveryPlatform: 'GRAB' },
      { passKind: 'DELIVERY', deliveryPlatform: 'FOODPANDA' },
      { passKind: 'DELIVERY', deliveryPlatform: 'FOODPANDA' },
      { passKind: 'STANDARD', deliveryPlatform: null },
    ];

    expect(recommendQuickPass(history)).toEqual({
      passKind: 'DELIVERY',
      platform: 'FOODPANDA',
      sampleSize: 3,
      personalized: true,
    });
  });

  it('uses the most recent pair to break a frequency tie', () => {
    const history: HistoryItem[] = [
      { passKind: 'E_HAILING', deliveryPlatform: 'GRAB' },
      { passKind: 'DELIVERY', deliveryPlatform: 'GRABFOOD' },
    ];

    expect(recommendQuickPass(history)).toMatchObject({
      passKind: 'E_HAILING',
      platform: 'GRAB',
      personalized: true,
    });
  });

  it('ignores incomplete quick-pass records', () => {
    expect(
      recommendQuickPass([
        { passKind: 'DELIVERY', deliveryPlatform: null },
        { passKind: 'STANDARD', deliveryPlatform: 'GRABFOOD' },
      ]),
    ).toMatchObject({ personalized: false, sampleSize: 0 });
  });
});
