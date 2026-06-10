import { describe, expect, it, vi } from 'vitest';
import { AttachmentCleanupService } from '../src/storage/attachment-cleanup.service';

describe('AttachmentCleanupService.sweep', () => {
  it('deletes EVERY variant key (avif + webp, display + thumb) for orphans', async () => {
    const orphan = {
      id: 'a1',
      key: 'k.avif',
      thumbnailKey: 't.avif',
      fallbackKey: 'k.webp',
      fallbackThumbnailKey: 't.webp',
    };
    const prisma: any = {
      attachment: {
        findMany: vi.fn().mockResolvedValue([orphan]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const storage: any = { removeMany: vi.fn().mockResolvedValue(undefined) };

    const svc = new AttachmentCleanupService(prisma, storage);
    const n = await svc.sweep();

    expect(n).toBe(1);
    const removed = storage.removeMany.mock.calls[0][0];
    expect(removed).toEqual(expect.arrayContaining(['k.avif', 't.avif', 'k.webp', 't.webp']));
    expect(removed).toHaveLength(4);
    expect(prisma.attachment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a1'] } } });
  });

  it('skips work when there are no orphans', async () => {
    const prisma: any = {
      attachment: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    };
    const storage: any = { removeMany: vi.fn() };
    const svc = new AttachmentCleanupService(prisma, storage);
    expect(await svc.sweep()).toBe(0);
    expect(storage.removeMany).not.toHaveBeenCalled();
  });
});
