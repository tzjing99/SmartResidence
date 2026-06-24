import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ImageService, UnsupportedImageError } from './image.service';

describe('ImageService.process', () => {
  const service = new ImageService();
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sr-img-test-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function tempFile(name: string, bytes: Buffer): Promise<string> {
    const p = join(dir, name);
    await writeFile(p, bytes);
    return p;
  }

  it('transcodes a real PNG to optimized webp with a thumbnail', async () => {
    const png = await sharp({
      create: { width: 200, height: 120, channels: 3, background: { r: 10, g: 120, b: 220 } },
    })
      .png()
      .toBuffer();
    const path = await tempFile('photo.png', png);

    const result = await service.process(path, 'image/png');

    expect(result.transcoded).toBe(true);
    expect(result.full.contentType).toBe('image/webp');
    expect(result.full.width).toBe(200);
    expect(result.full.height).toBe(120);
    expect(result.thumbnail?.contentType).toBe('image/webp');
    expect(result.sourceFormat).toBe('png');
  });

  it('downscales images larger than the max dimension', async () => {
    const png = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    const path = await tempFile('big.png', png);

    const result = await service.process(path, 'image/png');

    expect(result.full.width).toBeLessThanOrEqual(1600);
    expect(result.full.height).toBeLessThanOrEqual(1600);
  });

  it('passes animated gifs through untouched', async () => {
    const gifBytes = Buffer.from('GIF89a'); // header is enough for passthrough
    const path = await tempFile('anim.gif', gifBytes);

    const result = await service.process(path, 'image/gif');

    expect(result.transcoded).toBe(false);
    expect(result.full.contentType).toBe('image/gif');
    expect(result.thumbnail).toBeNull();
  });

  it('falls back to the original bytes for an undecodable non-HEIC image (no 500)', async () => {
    const garbage = Buffer.from('not a real jpeg at all');
    const path = await tempFile('broken.jpg', garbage);

    const result = await service.process(path, 'image/jpeg');

    expect(result.transcoded).toBe(false);
    expect(result.full.contentType).toBe('image/jpeg');
    expect(result.full.buffer.equals(garbage)).toBe(true);
  });

  it('throws a typed UnsupportedImageError for an undecodable HEIC (mapped to 4xx, not 500)', async () => {
    const garbage = Buffer.from('not a real heic');
    const path = await tempFile('broken.heic', garbage);

    await expect(service.process(path, 'image/heic')).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});
