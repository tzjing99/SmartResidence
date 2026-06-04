import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const KEY = 'sr.guard.pending.queue.v1';

export interface PendingCheckIn {
  id: string;
  qrCode: string;
  capturedAt: number;
  notes?: string;
  gateLocation?: string;
}

async function read(): Promise<PendingCheckIn[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingCheckIn[];
  } catch {
    return [];
  }
}

async function write(queue: PendingCheckIn[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function enqueueCheckIn(item: Omit<PendingCheckIn, 'id' | 'capturedAt'>) {
  const queue = await read();
  queue.push({ ...item, id: `${Date.now()}-${Math.random()}`, capturedAt: Date.now() });
  await write(queue);
}

export async function pendingCount(): Promise<number> {
  return (await read()).length;
}

/** Try to flush queued check-ins. Removes successful ones, retries failures. */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const queue = await read();
  let ok = 0;
  const remaining: PendingCheckIn[] = [];
  for (const entry of queue) {
    try {
      await api.checkInVisitor(entry.qrCode, {
        gateLocation: entry.gateLocation,
        notes: entry.notes,
      });
      ok++;
    } catch {
      remaining.push(entry);
    }
  }
  await write(remaining);
  return { ok, failed: remaining.length };
}
