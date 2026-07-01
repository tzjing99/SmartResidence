import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const KEY = 'sr.guard.patrol.queue.v1';

export interface PendingPatrolScan {
  id: string;
  code: string;
  capturedAt: number;
  note?: string;
  lat?: number;
  lng?: number;
}

async function read(): Promise<PendingPatrolScan[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingPatrolScan[];
  } catch {
    return [];
  }
}

async function write(queue: PendingPatrolScan[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function enqueuePatrolScan(item: Omit<PendingPatrolScan, 'id' | 'capturedAt'>) {
  const queue = await read();
  queue.push({ ...item, id: `${Date.now()}-${Math.random()}`, capturedAt: Date.now() });
  await write(queue);
}

export async function pendingPatrolCount(): Promise<number> {
  return (await read()).length;
}

/** Try to flush queued patrol scans. Removes successful ones, retries failures. */
export async function flushPatrolQueue(): Promise<{ ok: number; failed: number }> {
  const queue = await read();
  let ok = 0;
  const remaining: PendingPatrolScan[] = [];
  for (const entry of queue) {
    try {
      await api.scanPatrolCheckpoint({
        code: entry.code,
        source: 'OFFLINE',
        scannedAt: new Date(entry.capturedAt),
        note: entry.note,
        lat: entry.lat,
        lng: entry.lng,
      });
      ok++;
    } catch {
      remaining.push(entry);
    }
  }
  await write(remaining);
  return { ok, failed: remaining.length };
}
