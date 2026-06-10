import type { Readable } from 'node:stream';
import type { AppEnv } from '@/config/env.schema';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  bucket: string;
  key: string;
  expiresIn: number;
}

export interface ObjectStat {
  size: number;
  contentType: string;
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

  /** Upload an already-prepared buffer (e.g. an optimized image derivative). */
  async putObject(opts: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.client.putObject(this.bucket, opts.key, opts.body, opts.body.length, {
      'Content-Type': opts.contentType,
    });
  }

  /** Open a readable stream for an object (for lazy, low-memory delivery). */
  async getObjectStream(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }

  /** Read a whole object into a Buffer (used by the transcode worker). */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  async statObject(key: string): Promise<ObjectStat> {
    const stat = await this.client.statObject(this.bucket, key);
    return {
      size: stat.size,
      contentType: stat.metaData?.['content-type'] ?? 'application/octet-stream',
    };
  }

  async remove(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  /** Remove multiple objects, ignoring individual failures. */
  async removeMany(keys: string[]): Promise<void> {
    const valid = keys.filter((k): k is string => Boolean(k));
    if (valid.length === 0) return;
    try {
      await this.client.removeObjects(this.bucket, valid);
    } catch (err) {
      this.logger.warn(`Failed to remove objects: ${(err as Error).message}`);
    }
  }

  bucketName(): string {
    return this.bucket;
  }
}
