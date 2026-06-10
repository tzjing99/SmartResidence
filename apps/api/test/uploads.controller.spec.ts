import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageService } from '../src/storage/image.service';
import { UploadsController } from '../src/storage/uploads.controller';

const user: any = { id: 'user-1', roles: [] };

let png: Buffer;
let pngPath: string;
let pngSize: number;

beforeAll(async () => {
  png = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer();
  pngSize = png.length;
});

// The controller deletes the temp file in its `finally`, so re-create it before
// every test that needs it.
beforeEach(async () => {
  pngPath = join(tmpdir(), `sr-test-${nanoid(8)}.png`);
  await writeFile(pngPath, png);
});

function harness() {
  const storage = {
    putObject: vi.fn().mockResolvedValue(undefined),
    bucketName: vi.fn().mockReturnValue('bucket'),
  };
  const prisma = {
    attachment: {
      create: vi.fn(({ data }: any) => ({
        id: 'att-1',
        ...data,
        width: data.width ?? null,
        height: data.height ?? null,
        format: data.format ?? null,
      })),
    },
  };
  const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const controller = new UploadsController(
    storage as any,
    new ImageService(),
    prisma as any,
    queue as any,
  );
  return { controller, storage, prisma, queue };
}

afterEach(() => vi.clearAllMocks());

describe('UploadsController.upload (image)', () => {
  it('creates a PENDING attachment, stores original + inline thumb, and enqueues transcode', async () => {
    const { controller, storage, prisma, queue } = harness();
    const file: any = {
      mimetype: 'image/png',
      size: pngSize,
      originalname: 'photo.png',
      path: pngPath,
      filename: 'sr-upload',
    };

    const res = await controller.upload(user, file);

    expect(res.transcodeStatus).toBe('PENDING');
    expect(res.status).toBe('PENDING');
    expect(res.format).toBe('avif');
    // original + inline webp thumb both written.
    expect(storage.putObject).toHaveBeenCalledTimes(2);
    const createArg = prisma.attachment.create.mock.calls[0][0].data;
    expect(createArg.transcodeStatus).toBe('PENDING');
    expect(createArg.key).toContain('-original.');
    expect(createArg.thumbnailKey).toContain('-thumb.webp');
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    const job = queue.enqueue.mock.calls[0][0];
    expect(job.attachmentId).toBe('att-1');
    expect(job.mimeType).toBe('image/png');
  });
});

describe('UploadsController.upload (validation)', () => {
  it('rejects when declared image MIME is not allowed', async () => {
    const { controller } = harness();
    const file: any = {
      mimetype: 'image/tiff',
      size: pngSize,
      originalname: 'x.tiff',
      path: pngPath,
      filename: 'sr-upload',
    };
    await expect(controller.upload(user, file)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the declared MIME is PDF but bytes are not a PDF', async () => {
    const { controller } = harness();
    const file: any = {
      mimetype: 'application/pdf',
      size: pngSize,
      originalname: 'fake.pdf',
      path: pngPath, // actually a PNG
      filename: 'sr-upload',
    };
    await expect(controller.upload(user, file)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when image content does not match a supported image (spoofed)', async () => {
    const { controller } = harness();
    const garbagePath = join(tmpdir(), `sr-test-${nanoid(8)}.bin`);
    await writeFile(garbagePath, Buffer.from('this is definitely not an image at all!!'));
    const file: any = {
      mimetype: 'image/png',
      size: 40,
      originalname: 'x.png',
      path: garbagePath,
      filename: 'sr-upload',
    };
    await expect(controller.upload(user, file)).rejects.toBeInstanceOf(BadRequestException);
  });
});
