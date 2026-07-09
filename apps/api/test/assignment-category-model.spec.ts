import { describe, expect, it } from 'vitest';
import {
  buildSyntheticAssignmentSamples,
  parseAssignmentCategoryModel,
  predictCategoryFromText,
  trainAssignmentCategoryModel,
} from '../src/threads/ml/assignment-category-model';

describe('assignment-category-model', () => {
  it('trains and predicts maintenance from leak/repair language', () => {
    const model = trainAssignmentCategoryModel(buildSyntheticAssignmentSamples());
    expect(model).not.toBeNull();
    if (!model) return;
    const pred = predictCategoryFromText(
      model,
      'Kitchen pipe leaking water repair needed urgently',
    );
    expect(pred?.category).toBe('MAINTENANCE');
    expect(pred?.confidence).toBeGreaterThan(0.4);
  });

  it('trains and predicts billing from invoice language', () => {
    const model = trainAssignmentCategoryModel(buildSyntheticAssignmentSamples());
    expect(model).not.toBeNull();
    if (!model) return;
    const pred = predictCategoryFromText(
      model,
      'Monthly maintenance fee invoice overdue payment charge',
    );
    expect(pred?.category).toBe('BILLING');
  });

  it('round-trips through JSON parse', () => {
    const model = trainAssignmentCategoryModel(buildSyntheticAssignmentSamples());
    expect(model).not.toBeNull();
    if (!model) return;
    const raw = JSON.parse(JSON.stringify(model));
    const parsed = parseAssignmentCategoryModel(raw);
    expect(parsed?.totalSamples).toBe(model.totalSamples);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(predictCategoryFromText(parsed, 'Lost access card cctv security')?.category).toBe(
      'SECURITY',
    );
  });

  it('rejects invalid payloads', () => {
    expect(parseAssignmentCategoryModel(null)).toBeNull();
    expect(parseAssignmentCategoryModel({ version: 2 })).toBeNull();
    expect(parseAssignmentCategoryModel({ version: 1, totalSamples: 0 })).toBeNull();
  });
});
