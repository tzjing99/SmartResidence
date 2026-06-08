import type { ThreadPriority } from '@prisma/client';

const PRIORITIES: ThreadPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

/** Tokenise subject + body for a lightweight bag-of-words model. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export interface TrainingSample {
  priority: ThreadPriority;
  tokens: string[];
}

export interface NaiveBayesModel {
  classCounts: Record<ThreadPriority, number>;
  wordCounts: Record<ThreadPriority, Map<string, number>>;
  vocabularySize: Record<ThreadPriority, number>;
  totalSamples: number;
}

export function trainNaiveBayes(samples: TrainingSample[]): NaiveBayesModel | null {
  if (samples.length === 0) return null;

  const classCounts = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<
    ThreadPriority,
    number
  >;
  const wordCounts = Object.fromEntries(
    PRIORITIES.map((p) => [p, new Map<string, number>()]),
  ) as Record<ThreadPriority, Map<string, number>>;
  const vocabularySize = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<
    ThreadPriority,
    number
  >;

  for (const sample of samples) {
    classCounts[sample.priority] += 1;
    const bag = wordCounts[sample.priority];
    const seen = new Set<string>();
    for (const token of sample.tokens) {
      bag.set(token, (bag.get(token) ?? 0) + 1);
      if (!seen.has(token)) {
        seen.add(token);
        vocabularySize[sample.priority] += 1;
      }
    }
  }

  return {
    classCounts,
    wordCounts,
    vocabularySize,
    totalSamples: samples.length,
  };
}

export interface PredictionResult {
  priority: ThreadPriority;
  confidence: number;
}

/**
 * Predict priority with Laplace-smoothed multinomial Naive Bayes.
 * Returns null when the model is too uncertain (caller should fall back to rules).
 */
export function predictNaiveBayes(
  model: NaiveBayesModel,
  tokens: string[],
  minConfidence = 0.45,
): PredictionResult | null {
  if (tokens.length === 0 || model.totalSamples === 0) return null;

  const logScores: Array<{ priority: ThreadPriority; logP: number }> = [];

  for (const priority of PRIORITIES) {
    const classCount = model.classCounts[priority];
    if (classCount === 0) continue;

    let logP = Math.log(classCount / model.totalSamples);
    const bag = model.wordCounts[priority];
    const vocab = Math.max(1, model.vocabularySize[priority]);

    for (const token of tokens) {
      const count = bag.get(token) ?? 0;
      logP += Math.log((count + 1) / (classCount + vocab));
    }

    logScores.push({ priority, logP });
  }

  if (logScores.length === 0) return null;

  const maxLog = Math.max(...logScores.map((s) => s.logP));
  const probs = logScores.map((s) => ({
    priority: s.priority,
    p: Math.exp(s.logP - maxLog),
  }));
  const sum = probs.reduce((a, b) => a + b.p, 0);
  if (sum <= 0) return null;

  const ranked = probs
    .map((x) => ({ priority: x.priority, confidence: x.p / sum }))
    .sort((a, b) => b.confidence - a.confidence);

  const best = ranked[0];
  if (!best || best.confidence < minConfidence) return null;
  return best;
}
