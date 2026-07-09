/**
 * Offline trainer for the C6 assignment category model.
 *
 * Usage (from apps/api):
 *   corepack pnpm ml:train-assignment
 *   corepack pnpm ml:train-assignment -- --from-db --condo-id <uuid>
 *
 * Without --from-db, trains on a compact synthetic corpus and writes
 * ml-models/assignment-category-v1.json (committed artifact for CI/dev).
 *
 * With --from-db, reads closed threads for one condo (requires DATABASE_URL
 * + `prisma generate`) and writes the same path (or --out <path>).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  type AssignmentCategoryModel,
  type CategoryTrainingSample,
  buildSyntheticAssignmentSamples,
  trainAssignmentCategoryModel,
} from '../src/threads/ml/assignment-category-model';
import { DEFAULT_ASSIGNMENT_MODEL_RELATIVE_PATH } from '../src/threads/ml/assignment-model-store';
import { CLOSED_THREAD_STATUSES } from '../src/threads/ml/ml-assignment.constants';
import { tokenize } from '../src/threads/ml/naive-bayes-text';

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function loadSamplesFromDb(condoId: string): Promise<CategoryTrainingSample[]> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const threads = await prisma.thread.findMany({
      where: { condoId, status: { in: [...CLOSED_THREAD_STATUSES] } },
      select: {
        subject: true,
        category: true,
        messages: { take: 1, orderBy: { createdAt: 'asc' }, select: { body: true } },
      },
      take: 5000,
      orderBy: { closedAt: 'desc' },
    });
    return threads.map((t) => ({
      category: t.category,
      tokens: tokenize(`${t.subject} ${t.messages[0]?.body ?? ''}`),
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const fromDb = hasFlag('--from-db');
  const condoId = argValue('--condo-id');
  const outPath = resolve(argValue('--out') ?? DEFAULT_ASSIGNMENT_MODEL_RELATIVE_PATH);

  let samples: CategoryTrainingSample[];
  let source: string;

  if (fromDb) {
    if (!condoId) {
      throw new Error('--from-db requires --condo-id <uuid>');
    }
    samples = await loadSamplesFromDb(condoId);
    source = `db:condo=${condoId}`;
  } else {
    samples = buildSyntheticAssignmentSamples();
    source = 'synthetic';
  }

  const model = trainAssignmentCategoryModel(samples);
  if (!model) {
    throw new Error(`Training produced no model (samples=${samples.length}, source=${source})`);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  const payload: AssignmentCategoryModel & { source: string } = { ...model, source };
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const categoriesUsed = Object.entries(model.classCounts)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${c}=${n}`)
    .join(', ');

  console.log(
    `Wrote assignment category model → ${outPath}\n` +
      `  source=${source} samples=${model.totalSamples} trainedAt=${model.trainedAt}\n` +
      `  classes: ${categoriesUsed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
