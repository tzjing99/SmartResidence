/** Minimum closed threads before ML priority suggestions are allowed (C6). */
export const ML_PRIORITY_MIN_CLOSED_THREADS = 200;

/** In-memory model cache TTL — retrain periodically as new threads close. */
export const ML_PRIORITY_MODEL_CACHE_MS = 60 * 60 * 1000;

export const CLOSED_THREAD_STATUSES = ['RESOLVED', 'CLOSED'] as const;
