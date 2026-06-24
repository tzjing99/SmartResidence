import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { IMAGE_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, isHeic } from '@smartresidence/shared-types';
import sharp from 'sharp';

export interface ProcessedImage {
  /** Optimized full-size derivative. */
  full: { buffer: Buffer; contentType: string; width: number | null; height: number | null };
  /** Small thumbnail derivative (null if it could not be generated). */
  thumbnail: { buffer: Buffer; contentType: string } | null;
  /** True when we successfully re-encoded the source to a web-friendly format. */
  transcoded: boolean;
  /** Source format reported by sharp (e.g. `jpeg`, `heif`), or null if unknown. */
  sourceFormat: string | null;
}

/**
 * Thrown when an image cannot be decoded/transcoded and storing the original
 * bytes would not be useful (e.g. an HEIC the browser can't render). The
 * controller maps this to a 4xx so the client gets a clear message instead of
 * an opaque 500.
 */
export class UnsupportedImageError extends Error {
  constructor(
    readonly mimeType: string,
    message: string,
  ) {
    super(message);
    this.name = 'UnsupportedImageError';
  }
}

// Animated GIFs are stored as-is so we don't flatten the animation.
const PASSTHROUGH_MIME = new Set(['image/gif']);

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  /**
   * Optimize an uploaded image from a temp file path:
   * - auto-rotates via EXIF, downscales to a sane max dimension,
   * - re-encodes to webp (covers HEIC->web-viewable, shrinks phone photos),
   * - generates a thumbnail.
   *
   * sharp reads lazily from the file path rather than a full in-memory buffer,
   * so concurrent uploads of large photos don't multiply memory use. All sharp
   * work is wrapped so a corrupt/unsupported image never throws an unhandled
   * 500: non-HEIC inputs fall back to storing the original bytes, while HEIC
   * inputs that can't be decoded (no libheif/HEVC decoder on this host) raise a
   * typed {@link UnsupportedImageError} the controller turns into a 4xx.
   */
  async process(filePath: string, mimeType: string): Promise<ProcessedImage> {
    if (PASSTHROUGH_MIME.has(mimeType.toLowerCase())) {
      const original = await readFile(filePath);
      return {
        full: { buffer: original, contentType: mimeType, width: null, height: null },
        thumbnail: null,
        transcoded: false,
        sourceFormat: 'gif',
      };
    }

    let sourceFormat: string | null = null;
    try {
      const meta = await sharp(filePath, { failOn: 'none' }).metadata();
      sourceFormat = meta.format ?? null;
    } catch {
      // Header probe failed; the encode attempt below will decide the outcome.
    }

    try {
      const { data: fullBuffer, info: fullInfo } = await sharp(filePath, { failOn: 'none' })
        .rotate()
        .resize({
          width: IMAGE_MAX_DIMENSION,
          height: IMAGE_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });

      const thumbnail = await sharp(filePath, { failOn: 'none' })
        .rotate()
        .resize({
          width: THUMBNAIL_MAX_DIMENSION,
          height: THUMBNAIL_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 70 })
        .toBuffer();

      return {
        full: {
          buffer: fullBuffer,
          contentType: 'image/webp',
          width: fullInfo.width ?? null,
          height: fullInfo.height ?? null,
        },
        thumbnail: { buffer: thumbnail, contentType: 'image/webp' },
        transcoded: true,
        sourceFormat,
      };
    } catch (err) {
      const reason = (err as Error).message;
      this.logger.warn(`Image optimization failed (mime=${mimeType}, format=${sourceFormat}): ${reason}`);

      // HEIC/HEIF that can't be transcoded is useless to web/Android clients
      // (they can't render it), so reject with a clear, typed 4xx instead of
      // silently storing un-viewable bytes.
      if (isHeic(mimeType)) {
        throw new UnsupportedImageError(
          mimeType,
          'This HEIC/HEIF photo could not be processed. Please upload a JPEG or PNG instead.',
        );
      }

      // Other decodable-on-most-clients formats: keep the original so the
      // upload still succeeds even if sharp couldn't optimize it.
      const original = await readFile(filePath);
      return {
        full: { buffer: original, contentType: mimeType, width: null, height: null },
        thumbnail: null,
        transcoded: false,
        sourceFormat,
      };
    }
  }
}
