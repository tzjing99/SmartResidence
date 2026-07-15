import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  AccessCodeConflictError,
  isAccessCodeConflict,
  isPrismaSerializationFailure,
  isPrismaUniqueConflict,
  withSerializableRetry,
  withUniqueAccessCodeRetry,
} from '../src/visitor/access-code';

function prismaErr(code: string) {
  return new Prisma.PrismaClientKnownRequestError('conflict', {
    code,
    clientVersion: 'test',
  });
}

describe('access-code concurrency helpers', () => {
  it('detects P2002 unique conflicts and soft AccessCodeConflictError', () => {
    expect(isPrismaUniqueConflict(prismaErr('P2002'))).toBe(true);
    expect(isPrismaUniqueConflict(prismaErr('P2034'))).toBe(false);
    expect(isAccessCodeConflict(new AccessCodeConflictError())).toBe(true);
    expect(isAccessCodeConflict(prismaErr('P2002'))).toBe(true);
    expect(isAccessCodeConflict(new Error('other'))).toBe(false);
  });

  it('detects Serializable abort (P2034)', () => {
    expect(isPrismaSerializationFailure(prismaErr('P2034'))).toBe(true);
    expect(isPrismaSerializationFailure(prismaErr('P2002'))).toBe(false);
  });

  it('retries allocate on unique conflict then succeeds (no check-then-act)', async () => {
    const allocate = vi
      .fn()
      .mockRejectedValueOnce(prismaErr('P2002'))
      .mockRejectedValueOnce(new AccessCodeConflictError())
      .mockResolvedValueOnce({ id: 'ok', accessCode: 'USED' });

    const result = await withUniqueAccessCodeRetry(allocate);
    expect(result).toEqual({ id: 'ok', accessCode: 'USED' });
    expect(allocate).toHaveBeenCalledTimes(3);
    for (const call of allocate.mock.calls) {
      expect(call[0]).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('stops retrying unique conflicts after max attempts', async () => {
    const allocate = vi.fn().mockRejectedValue(prismaErr('P2002'));
    await expect(withUniqueAccessCodeRetry(allocate, 3)).rejects.toMatchObject({ code: 'P2002' });
    expect(allocate).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-conflict errors from allocate', async () => {
    const allocate = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(withUniqueAccessCodeRetry(allocate)).rejects.toThrow(/db down/);
    expect(allocate).toHaveBeenCalledTimes(1);
  });

  it('retries Serializable transactions on P2034 then succeeds', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(prismaErr('P2034'))
      .mockResolvedValueOnce('allocated');
    await expect(withSerializableRetry(run)).resolves.toBe('allocated');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('stops retrying Serializable aborts after max attempts', async () => {
    const run = vi.fn().mockRejectedValue(prismaErr('P2034'));
    await expect(withSerializableRetry(run, 2)).rejects.toMatchObject({ code: 'P2034' });
    expect(run).toHaveBeenCalledTimes(2);
  });
});
