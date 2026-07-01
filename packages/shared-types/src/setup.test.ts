import { describe, expect, it } from 'vitest';
import {
  type SetupChecklistFacts,
  type SetupStepStatus,
  isFreshSetupInstance,
  isSetupStepComplete,
  setupProgress,
} from './setup';

const emptyFacts: SetupChecklistFacts = {
  hasProfile: false,
  blockCount: 0,
  unitTypeCount: 0,
  unitCount: 0,
  feeRateCount: 0,
  hasReceiptTemplate: false,
  billingAutomationEnabled: false,
  enabledGatewayCount: 0,
  residentCount: 0,
  hasVisitorPolicy: false,
  hasHelpdeskSettings: false,
  slaPolicyCount: 0,
  mcpCount: 0,
  documentCount: 0,
};

describe('isFreshSetupInstance', () => {
  it('returns true when there is no structure or residents yet', () => {
    expect(isFreshSetupInstance(emptyFacts)).toBe(true);
  });

  it('returns false once blocks exist', () => {
    expect(isFreshSetupInstance({ ...emptyFacts, blockCount: 1 })).toBe(false);
  });

  it('returns false once residents are invited', () => {
    expect(isFreshSetupInstance({ ...emptyFacts, residentCount: 1 })).toBe(false);
  });
});

describe('isSetupStepComplete', () => {
  it('treats satisfied, done, or skipped as complete', () => {
    const base: SetupStepStatus = {
      key: 'structure',
      done: false,
      skipped: false,
      updatedAt: null,
      satisfied: null,
    };
    expect(isSetupStepComplete({ ...base, satisfied: true })).toBe(true);
    expect(isSetupStepComplete({ ...base, done: true })).toBe(true);
    expect(isSetupStepComplete({ ...base, skipped: true })).toBe(true);
    expect(isSetupStepComplete(base)).toBe(false);
  });
});

describe('setupProgress', () => {
  it('excludes the review step from totals', () => {
    const progress = setupProgress({
      steps: [
        { key: 'condoProfile', done: true, skipped: false, updatedAt: null, satisfied: true },
        { key: 'structure', done: false, skipped: false, updatedAt: null, satisfied: null },
        { key: 'review', done: false, skipped: false, updatedAt: null, satisfied: null },
      ],
    });
    expect(progress).toEqual({ completed: 1, total: 2 });
  });
});
