import type { AppEnv } from '@/config/env.schema';
import { EInvoiceService } from '@/einvoice/einvoice.service';
import { NotificationService } from '@/notification/notification.service';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import type { NotificationKind } from '@prisma/client';
import { type ConnectionOptions, Queue, Worker } from 'bullmq';

export type NotificationDeliveryJob = {
  userIds: string[];
  kind: NotificationKind;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  timeZone?: string;
  condoId?: string;
};

export type EInvoiceSubmitJob = {
  invoiceId: string;
};

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private notificationQueue?: Queue;
  private eInvoiceQueue?: Queue;
  private workers: Worker[] = [];
  private connection?: ConnectionOptions;

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.connection = { url: this.config.get('REDIS_URL', { infer: true }) };
    this.notificationQueue = new Queue('notification-delivery', { connection: this.connection });
    this.eInvoiceQueue = new Queue('einvoice-submit', { connection: this.connection });

    this.workers.push(
      new Worker(
        'notification-delivery',
        async (job) => {
          const notifications = this.moduleRef.get(NotificationService, { strict: false });
          await notifications.processDeliveryJob(job.data as NotificationDeliveryJob);
        },
        { connection: this.connection },
      ),
      new Worker(
        'einvoice-submit',
        async (job) => {
          const einvoice = this.moduleRef.get(EInvoiceService, { strict: false });
          await einvoice.processSubmitJob(job.data as EInvoiceSubmitJob);
        },
        { connection: this.connection },
      ),
    );

    for (const worker of this.workers) {
      worker.on('failed', (job, err) => {
        this.logger.warn(`Job ${job?.name ?? '?'} failed: ${err.message}`);
      });
    }

    this.logger.log('BullMQ workers started (notification-delivery, einvoice-submit)');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      ...this.workers.map((w) => w.close()),
      this.notificationQueue?.close(),
      this.eInvoiceQueue?.close(),
    ]);
  }

  async enqueueNotificationDelivery(job: NotificationDeliveryJob): Promise<void> {
    if (!this.notificationQueue) {
      const notifications = this.moduleRef.get(NotificationService, { strict: false });
      await notifications.processDeliveryJob(job);
      return;
    }
    await this.notificationQueue.add('deliver', job, {
      removeOnComplete: 500,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  async enqueueEInvoiceSubmit(job: EInvoiceSubmitJob): Promise<void> {
    if (!this.eInvoiceQueue) {
      const einvoice = this.moduleRef.get(EInvoiceService, { strict: false });
      await einvoice.processSubmitJob(job);
      return;
    }
    await this.eInvoiceQueue.add('submit', job, {
      removeOnComplete: 500,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
