import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { ImageService } from '../src/storage/image.service';

let png: Buffer;

beforeAll(async () => {
  // A real, decodable image larger than both target dimensions so resize kicks in.
  png = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 12, g: 34, b: 56 } },
  })
    .png()
    .toBuffer();
});

describe('ImageService.transcode', () => {
  it('emits the AVIF + WebP variant set with correct content types and dimensions', async () => {
    const svc = new ImageService();
    const result = await svc.transcode(png, 'image/png');
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.displayAvif.contentType).toBe('image/avif');
    expect(result.thumbAvif.contentType).toBe('image/avif');
    expect(result.displayWebp.contentType).toBe('image/webp');
    expect(result.thumbWebp.contentType).toBe('image/webp');

    for (const v of [result.displayAvif, result.thumbAvif, result.displayWebp, result.thumbWebp]) {
      expect(v.buffer.length).toBeGreaterThan(0);
    }

    // Display longest edge <= 1600, thumb longest edge <= 400.
    expect(
      Math.max(result.displayAvif.width ?? 0, result.displayAvif.height ?? 0),
    ).toBeLessThanOrEqual(1600);
    expect(Math.max(result.thumbAvif.width ?? 0, result.thumbAvif.height ?? 0)).toBeLessThanOrEqual(
      400,
    );

    // The encoded bytes really are AVIF / WebP (sniff the magic).
    const avifMeta = await sharp(result.displayAvif.buffer).metadata();
    expect(avifMeta.format).toBe('heif'); // sharp reports AVIF as the heif container
    const webpMeta = await sharp(result.displayWebp.buffer).metadata();
    expect(webpMeta.format).toBe('webp');
  });

  it('returns null for GIF passthrough (animation preserved upstream)', async () => {
    const svc = new ImageService();
    expect(svc.isPassthrough('image/gif')).toBe(true);
    expect(await svc.transcode(Buffer.from('GIF89a'), 'image/gif')).toBeNull();
  });

  it('returns null when sharp cannot decode the input (e.g. HEIC without libheif)', async () => {
    const svc = new ImageService();
    const garbage = Buffer.from('definitely not a real image payload');
    expect(await svc.transcode(garbage, 'image/heic')).toBeNull();
  });
});

describe('ImageService.makeInlineThumbnail', () => {
  it('produces a cheap WebP thumbnail and captures source dimensions', async () => {
    const svc = new ImageService();
    const inline = await svc.makeInlineThumbnail(png, 'image/png');
    expect(inline.passthrough).toBe(false);
    expect(inline.thumbnail?.contentType).toBe('image/webp');
    expect(inline.width).toBe(1200);
    expect(inline.height).toBe(800);
  });

  it('flags passthrough with no thumbnail for GIF', async () => {
    const svc = new ImageService();
    const inline = await svc.makeInlineThumbnail(Buffer.from('GIF89a'), 'image/gif');
    expect(inline.passthrough).toBe(true);
    expect(inline.thumbnail).toBeNull();
  });

  it('falls back to passthrough when the input cannot be decoded', async () => {
    const svc = new ImageService();
    const inline = await svc.makeInlineThumbnail(Buffer.from('nope'), 'image/heic');
    expect(inline.passthrough).toBe(true);
    expect(inline.thumbnail).toBeNull();
  });
});
