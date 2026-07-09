import type { ThreadCategory } from '@prisma/client';
import { tokenize } from './naive-bayes-text';

export const ASSIGNMENT_CATEGORIES: ThreadCategory[] = [
  'BILLING',
  'MAINTENANCE',
  'FACILITY',
  'SECURITY',
  'COMPLAINT',
  'SUGGESTION',
  'GOVERNANCE',
  'GENERAL',
];

export interface CategoryTrainingSample {
  category: ThreadCategory;
  tokens: string[];
}

/** Serializable multinomial Naive Bayes over thread categories (C6 assignment). */
export interface AssignmentCategoryModel {
  version: 1;
  classCounts: Record<ThreadCategory, number>;
  /** word → count per category (JSON-friendly plain objects). */
  wordCounts: Record<ThreadCategory, Record<string, number>>;
  vocabularySize: Record<ThreadCategory, number>;
  totalSamples: number;
  trainedAt: string;
}

export interface CategoryPrediction {
  category: ThreadCategory;
  confidence: number;
}

function emptyCounts(): Record<ThreadCategory, number> {
  return Object.fromEntries(ASSIGNMENT_CATEGORIES.map((c) => [c, 0])) as Record<
    ThreadCategory,
    number
  >;
}

function emptyWordBags(): Record<ThreadCategory, Record<string, number>> {
  return Object.fromEntries(ASSIGNMENT_CATEGORIES.map((c) => [c, {}])) as Record<
    ThreadCategory,
    Record<string, number>
  >;
}

export function trainAssignmentCategoryModel(
  samples: CategoryTrainingSample[],
  trainedAt = new Date().toISOString(),
): AssignmentCategoryModel | null {
  if (samples.length === 0) return null;

  const classCounts = emptyCounts();
  const wordCounts = emptyWordBags();
  const vocabularySize = emptyCounts();

  for (const sample of samples) {
    classCounts[sample.category] += 1;
    const bag = wordCounts[sample.category];
    const seen = new Set<string>();
    for (const token of sample.tokens) {
      bag[token] = (bag[token] ?? 0) + 1;
      if (!seen.has(token)) {
        seen.add(token);
        vocabularySize[sample.category] += 1;
      }
    }
  }

  return {
    version: 1,
    classCounts,
    wordCounts,
    vocabularySize,
    totalSamples: samples.length,
    trainedAt,
  };
}

/**
 * Predict category with Laplace-smoothed multinomial Naive Bayes.
 * Returns null when confidence is below the threshold (caller falls back).
 */
export function predictAssignmentCategory(
  model: AssignmentCategoryModel,
  tokens: string[],
  minConfidence = 0.4,
): CategoryPrediction | null {
  if (tokens.length === 0 || model.totalSamples === 0) return null;

  const logScores: Array<{ category: ThreadCategory; logP: number }> = [];

  for (const category of ASSIGNMENT_CATEGORIES) {
    const classCount = model.classCounts[category];
    if (classCount === 0) continue;

    let logP = Math.log(classCount / model.totalSamples);
    const bag = model.wordCounts[category];
    const vocab = Math.max(1, model.vocabularySize[category]);

    for (const token of tokens) {
      const count = bag[token] ?? 0;
      logP += Math.log((count + 1) / (classCount + vocab));
    }

    logScores.push({ category, logP });
  }

  if (logScores.length === 0) return null;

  const maxLog = Math.max(...logScores.map((s) => s.logP));
  const probs = logScores.map((s) => ({
    category: s.category,
    p: Math.exp(s.logP - maxLog),
  }));
  const sum = probs.reduce((a, b) => a + b.p, 0);
  if (sum <= 0) return null;

  const ranked = probs
    .map((x) => ({ category: x.category, confidence: x.p / sum }))
    .sort((a, b) => b.confidence - a.confidence);

  const best = ranked[0];
  if (!best || best.confidence < minConfidence) return null;
  return best;
}

export function predictCategoryFromText(
  model: AssignmentCategoryModel,
  text: string,
  minConfidence = 0.4,
): CategoryPrediction | null {
  return predictAssignmentCategory(model, tokenize(text), minConfidence);
}

export function parseAssignmentCategoryModel(raw: unknown): AssignmentCategoryModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<AssignmentCategoryModel>;
  if (m.version !== 1 || typeof m.totalSamples !== 'number' || m.totalSamples < 1) return null;
  if (!m.classCounts || !m.wordCounts || !m.vocabularySize || !m.trainedAt) return null;
  return m as AssignmentCategoryModel;
}

/** Compact synthetic corpus used by the offline train script and unit tests. */
export function buildSyntheticAssignmentSamples(): CategoryTrainingSample[] {
  const corpus: Array<{ category: ThreadCategory; texts: string[] }> = [
    {
      category: 'BILLING',
      texts: [
        'Monthly maintenance fee invoice overdue payment',
        'Billing statement charge incorrect amount',
        'Need receipt for management fee payment',
        'Dispute late payment penalty on invoice',
        'Sinking fund contribution billing question',
      ],
    },
    {
      category: 'MAINTENANCE',
      texts: [
        'Kitchen pipe leaking water repair needed',
        'Broken aircon unit not cooling bedroom',
        'Lift elevator stuck between floors again',
        'Toilet flush broken plumber required',
        'Corridor light flickering electrical repair',
      ],
    },
    {
      category: 'FACILITY',
      texts: [
        'Gym treadmill out of order booking',
        'Swimming pool water cloudy facility issue',
        'BBQ pit reservation for weekend party',
        'Function room air conditioning not working',
        'Tennis court lights not turning on',
      ],
    },
    {
      category: 'SECURITY',
      texts: [
        'Lost access card need replacement urgently',
        'Suspicious person near lobby cctv check',
        'Car park barrier gate not opening',
        'Visitor tailgating through security door',
        'Break-in attempt reported at unit door',
      ],
    },
    {
      category: 'COMPLAINT',
      texts: [
        'Neighbour loud noise late night complaint',
        'Secondhand smoke entering balcony complaint',
        'Illegal parking blocking driveway complaint',
        'Dog barking continuously from next unit',
        'Renovation dust and noise from upstairs',
      ],
    },
    {
      category: 'SUGGESTION',
      texts: [
        'Suggest adding more bicycle parking racks',
        'Proposal for community garden planting area',
        'Idea to extend gym opening hours weekends',
        'Recommend recycling bins on every floor',
        'Suggestion for better visitor registration app',
      ],
    },
    {
      category: 'GOVERNANCE',
      texts: [
        'AGM meeting agenda and proxy voting form',
        'Request minutes from last committee meeting',
        'Motion to review bylaws on short stay',
        'Election of management committee members',
        'Budget approval for facade painting project',
      ],
    },
    {
      category: 'GENERAL',
      texts: [
        'General enquiry about moving in procedures',
        'Where to collect parcel from lobby desk',
        'Question about office opening hours today',
        'Need contact for management office staff',
        'Hello checking how to update my details',
      ],
    },
  ];

  const samples: CategoryTrainingSample[] = [];
  for (const { category, texts } of corpus) {
    for (const text of texts) {
      samples.push({ category, tokens: tokenize(text) });
    }
  }
  return samples;
}
