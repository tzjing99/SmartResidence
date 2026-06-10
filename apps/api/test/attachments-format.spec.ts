import { describe, expect, it } from 'vitest';
import { AttachmentsController } from '../src/storage/attachments.controller';

function controller() {
  return new AttachmentsController({} as any, {} as any);
}

const ready: any = {
  key: 'k.avif',
  thumbnailKey: 't.avif',
  mimeType: 'image/avif',
  format: 'avif',
  fallbackKey: 'k.webp',
  fallbackMimeType: 'image/webp',
  fallbackThumbnailKey: 't.webp',
  transcodeStatus: 'READY',
};

const pending: any = {
  key: 'orig.png',
  thumbnailKey: 'inline-thumb.webp',
  mimeType: 'image/png',
  format: 'avif',
  fallbackKey: null,
  fallbackMimeType: null,
  fallbackThumbnailKey: null,
  transcodeStatus: 'PENDING',
};

function resolve(att: any, variant: 'raw' | 'thumb', format: 'avif' | 'webp') {
  return (controller() as any).resolveVariant(att, variant, format);
}

describe('AttachmentsController.resolveVariant (READY)', () => {
  it('serves AVIF display when avif requested', () => {
    expect(resolve(ready, 'raw', 'avif')).toEqual({ key: 'k.avif', contentType: 'image/avif' });
  });
  it('serves WebP display when webp requested', () => {
    expect(resolve(ready, 'raw', 'webp')).toEqual({ key: 'k.webp', contentType: 'image/webp' });
  });
  it('serves AVIF thumb when avif requested', () => {
    expect(resolve(ready, 'thumb', 'avif')).toEqual({ key: 't.avif', contentType: 'image/avif' });
  });
  it('serves WebP thumb when webp requested', () => {
    expect(resolve(ready, 'thumb', 'webp')).toEqual({ key: 't.webp', contentType: 'image/webp' });
  });
});

describe('AttachmentsController.resolveVariant (PENDING, not transcoded yet)', () => {
  it('raw avif falls back to the original key (no AVIF/WebP yet)', () => {
    expect(resolve(pending, 'raw', 'avif')).toEqual({ key: 'orig.png', contentType: 'image/png' });
  });
  it('thumb avif falls back to the inline WebP thumbnail', () => {
    expect(resolve(pending, 'thumb', 'avif')).toEqual({
      key: 'inline-thumb.webp',
      contentType: 'image/webp',
    });
  });
});
