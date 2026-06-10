import { RedisService } from '@/redis/redis.service';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type ConnectionOptions, Queue } from 'bullmq';

export const TRANSCODE_QUEUE_NAME = 'attachment-transcode';

/** Payload for a single attachment transcode job. */
export interface TranscodeJobData {
  attachmentId: string;
  bucket: string;
  /** Key of the (temporary) original bytes to transcode. */
  originalKey: string;
  /** Shared key prefix (no extension), e.g. `uploads/{userId}/{ts}-{nanoid}`. */
  prefix: string;
  /** Sanitized base file name for the display key suffix. */
  safeName: string;
  mimeType: string;
}

/** Deterministic variant keys derived from the shared prefix. */
export function variantKeys(prefix: string, safeName: string) {
  return {
    displayAvif: `${prefix}-${safeName}.avif`,
    thumbAvif: `${prefix}-thumb.avif`,
    displayWebp: `${prefix}-${safeName}.webp`,
    // Reuses the inline thumbnail key so the cheap thumb is overwritten in
    // place (no orphan) once the worker produces the final WebP thumb.
    thumbWebp: `${prefix}-thumb.webp`,
  };
}

@Injectable()
export class TranscodeQueue implements OnModuleDestroy {
  private readonly logger = new Logger(TranscodeQueue.name);
  readonly queue: Queue<TranscodeJobData>;

  constructor(private readonly redis: RedisService) {
    // Reuses the shared RedisService connection (maxRetriesPerRequest: null,
    // exactly what BullMQ needs). Queue commands are non-blocking, so sharing
    // the app connection is safe; the Worker uses a dedicated duplicate.
    // Cast: the monorepo resolves two ioredis copies (the app's and the one
    // BullMQ's types reference), so the structurally-identical client needs a
    // cast to BullMQ's ConnectionOptions.
    this.queue = new Queue<TranscodeJobData>(TRANSCODE_QUEUE_NAME, {
      connection: this.redis.client as unknown as ConnectionOptions,
    });
  }

  async enqueue(data: TranscodeJobData): Promise<void> {
    await this.queue.add('transcode', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      removeOnFail: 200,
    });
    this.logger.debug?.(`Enqueued transcode for ${data.attachmentId}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
