import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { TranscodeStatus } from '@prisma/client';
import { type ConnectionOptions, type Job, Worker } from 'bullmq';
import sharp from 'sharp';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';
import { TRANSCODE_QUEUE_NAME, type TranscodeJobData, variantKeys } from './transcode.queue';

/** How many transcode jobs run concurrently on this process. */
const WORKER_CONCURRENCY = 3;

/**
 * Background worker that turns a freshly-uploaded original into the AVIF + WebP
 * variant set. Runs off the request thread so uploads stay snappy. Pins
 * libvips to a single thread per job (`sharp.concurrency(1)`) and caps job
 * concurrency so transcodes never starve the API process.
 */
@Injectable()
export class TranscodeProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TranscodeProcessor.name);
  private worker: Worker<TranscodeJobData> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    sharp.concurrency(1);
    this.worker = new Worker<TranscodeJobData>(TRANSCODE_QUEUE_NAME, (job) => this.handle(job), {
      // Dedicated blocking connection (duplicate inherits maxRetriesPerRequest: null).
      connection: this.redis.client.duplicate() as unknown as ConnectionOptions,
      concurrency: WORKER_CONCURRENCY,
    });
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Transcode job ${job?.id} failed: ${err.message}`);
      // Mark FAILED only after retries are exhausted; keep the original so the
      // attachment is still serviceable.
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void this.markFailed(job.data.attachmentId);
      }
    });
    this.logger.log(`Transcode worker started (concurrency ${WORKER_CONCURRENCY})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job<TranscodeJobData>): Promise<void> {
    const { attachmentId, originalKey, prefix, safeName, mimeType } = job.data;

    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      this.logger.warn(`Attachment ${attachmentId} gone before transcode; dropping job`);
      return;
    }

    const original = await this.storage.getObjectBuffer(originalKey);
    const result = await this.images.transcode(original, mimeType);

    // Undecodable (e.g. HEIC without libheif on a dev host) or passthrough:
    // keep the original, mark SKIPPED so serving falls back to it.
    if (!result) {
      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: { transcodeStatus: TranscodeStatus.SKIPPED },
      });
      this.logger.log(`Transcode SKIPPED for ${attachmentId} (${mimeType})`);
      return;
    }

    const keys = variantKeys(prefix, safeName);
    await Promise.all([
      this.storage.putObject({
        key: keys.displayAvif,
        body: result.displayAvif.buffer,
        contentType: 'image/avif',
      }),
      this.storage.putObject({
        key: keys.thumbAvif,
        body: result.thumbAvif.buffer,
        contentType: 'image/avif',
      }),
      this.storage.putObject({
        key: keys.displayWebp,
        body: result.displayWebp.buffer,
        contentType: 'image/webp',
      }),
      this.storage.putObject({
        key: keys.thumbWebp,
        body: result.thumbWebp.buffer,
        contentType: 'image/webp',
      }),
    ]);

    const existingMeta =
      attachment.metadata && typeof attachment.metadata === 'object'
        ? (attachment.metadata as Record<string, unknown>)
        : {};

    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        key: keys.displayAvif,
        thumbnailKey: keys.thumbAvif,
        mimeType: 'image/avif',
        format: 'avif',
        fallbackKey: keys.displayWebp,
        fallbackMimeType: 'image/webp',
        fallbackThumbnailKey: keys.thumbWebp,
        size: result.displayAvif.buffer.length,
        width: result.displayAvif.width,
        height: result.displayAvif.height,
        transcodeStatus: TranscodeStatus.READY,
        metadata: {
          ...existingMeta,
          variantBytes: {
            displayAvif: result.displayAvif.buffer.length,
            thumbAvif: result.thumbAvif.buffer.length,
            displayWebp: result.displayWebp.buffer.length,
            thumbWebp: result.thumbWebp.buffer.length,
          },
        },
      },
    });

    // Discard the original to minimize disk — derivatives are the only copy.
    if (originalKey !== keys.displayAvif) {
      await this.storage
        .remove(originalKey)
        .catch((err) =>
          this.logger.warn(`Failed to delete original ${originalKey}: ${(err as Error).message}`),
        );
    }
    this.logger.log(`Transcode READY for ${attachmentId}`);
  }

  private async markFailed(attachmentId: string): Promise<void> {
    await this.prisma.attachment
      .update({ where: { id: attachmentId }, data: { transcodeStatus: TranscodeStatus.FAILED } })
      .catch(() => undefined);
  }
}
