import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AssignmentCategoryModel,
  parseAssignmentCategoryModel,
} from './assignment-category-model';

/** Default relative path from apps/api cwd. */
export const DEFAULT_ASSIGNMENT_MODEL_RELATIVE_PATH = join(
  'ml-models',
  'assignment-category-v1.json',
);

/**
 * Resolve the on-disk assignment model path.
 * Override with `ML_ASSIGNMENT_MODEL_PATH` (absolute or cwd-relative).
 * Falls back to `apps/api/ml-models/...` when the API is started from the monorepo root.
 */
export function resolveAssignmentModelPath(
  cwd = process.cwd(),
  envPath = process.env.ML_ASSIGNMENT_MODEL_PATH,
): string {
  if (envPath && envPath.trim().length > 0) {
    return envPath.trim();
  }
  const primary = join(cwd, DEFAULT_ASSIGNMENT_MODEL_RELATIVE_PATH);
  const monorepoRoot = join(cwd, 'apps', 'api', DEFAULT_ASSIGNMENT_MODEL_RELATIVE_PATH);
  if (existsSync(primary)) return primary;
  if (existsSync(monorepoRoot)) return monorepoRoot;
  return primary;
}

export function loadAssignmentCategoryModelFromDisk(
  path = resolveAssignmentModelPath(),
): AssignmentCategoryModel | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return parseAssignmentCategoryModel(raw);
  } catch {
    return null;
  }
}
