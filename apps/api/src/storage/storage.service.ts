import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import type { AppEnv } from '@/config/env.schema';

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  bucket: string;
  key: string;
  expiresIn: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor(config: ConfigService<AppEnv, true>) {
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    const url = new URL(endpoint);
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.client = new MinioClient({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
      useSSL: url.protocol === 'https:',
      accessKey: config.get('S3_ACCESS_KEY', { infer: true }),
      secretKey: config.get('S3_SECRET_KEY', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created bucket ${this.bucket}`);
      }
    } catch (err) {
      this.logger.warn(`Could not verify storage bucket: ${(err as Error).message}`);
    }
  }

  /** Generate a presigned PUT URL for a client to upload directly to S3. */
  async presignUpload(opts: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<PresignedUpload> {
    const expiresIn = opts.expiresIn ?? 60 * 5;
    const url = await this.client.presignedPutObject(this.bucket, opts.key, expiresIn);
    return {
      url,
      fields: { 'Content-Type': opts.contentType },
      bucket: this.bucket,
      key: opts.key,
      expiresIn,
    };
  }

  async presignDownload(key: string, expiresIn = 60 * 5): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresIn);
  }

  async remove(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  bucketName(): string {
    return this.bucket;
  }
}
