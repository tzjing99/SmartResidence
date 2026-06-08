import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AttachmentStatus } from '@prisma/client';
import { ORPHAN_ATTACHMENT_TTL_HOURS } from '@smartresidence/shared-types';
import { StorageService } from './storage.service';

/**
 * Sweeps abandoned uploads. When a user picks photos in a compose panel but
 * never sends the message, those attachments stay PENDING. This periodic job
 * deletes PENDING attachments older than the TTL (and their storage objects)
 * so they don't hog disk/bandwidth forever. Mirrors the SLA scanner's plain
 * setInterval pattern (no extra scheduler dependency).
 */
@Injectable()
export class AttachmentCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttachmentCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  private static readonly SWEEP_INTERVAL_MS = 60 * 60_000; // hourly
  private static readonly BATCH = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.sweep().catch((err) =>
        this.logger.warn(`Attachment sweep failed: ${(err as Error).message}`),
      );
    }, AttachmentCleanupService.SWEEP_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log(
      `Orphan attachment sweeper started (interval 1h, TTL ${ORPHAN_ATTACHMENT_TTL_HOURS}h)`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Delete PENDING attachments older than the TTL plus their storage objects. */
  async sweep(): Promise<number> {
    const cutoff = new Date(Date.now() - ORPHAN_ATTACHMENT_TTL_HOURS * 60 * 60_000);
    const orphans = await this.prisma.attachment.findMany({
      where: { status: AttachmentStatus.PENDING, createdAt: { lt: cutoff } },
      select: { id: true, key: true, thumbnailKey: true },
      take: AttachmentCleanupService.BATCH,
    });
    if (orphans.length === 0) return 0;

    const keys = orphans.flatMap((a) => [a.key, a.thumbnailKey].filter((k): k is string => !!k));
    await this.storage.removeMany(keys);
    await this.prisma.attachment.deleteMany({ where: { id: { in: orphans.map((a) => a.id) } } });

    this.logger.log(`Swept ${orphans.length} orphaned attachment(s)`);
    return orphans.length;
  }
}
