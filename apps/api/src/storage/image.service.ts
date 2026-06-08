import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { IMAGE_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION } from '@smartresidence/shared-types';
import sharp from 'sharp';

export interface ProcessedImage {
  /** Optimized full-size derivative. */
  full: { buffer: Buffer; contentType: string; width: number | null; height: number | null };
  /** Small thumbnail derivative (null if it could not be generated). */
  thumbnail: { buffer: Buffer; contentType: string } | null;
  /** True when sharp could not decode the input and we fell back to the raw bytes. */
  fellBack: boolean;
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
   * sharp's prebuilt libvips may lack HEIC decode on some hosts; in that case
   * (or for passthrough types) we store the original bytes untouched so the
   * upload never hard-fails.
   */
  async process(filePath: string, mimeType: string): Promise<ProcessedImage> {
    const original = await readFile(filePath);

    if (PASSTHROUGH_MIME.has(mimeType.toLowerCase())) {
      return {
        full: { buffer: original, contentType: mimeType, width: null, height: null },
        thumbnail: null,
        fellBack: true,
      };
    }

    try {
      const base = sharp(original, { failOn: 'none' }).rotate();
      const meta = await base.metadata();

      const full = await sharp(original, { failOn: 'none' })
        .rotate()
        .resize({
          width: IMAGE_MAX_DIMENSION,
          height: IMAGE_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();

      const fullMeta = await sharp(full).metadata();

      const thumbnail = await sharp(original, { failOn: 'none' })
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
          buffer: full,
          contentType: 'image/webp',
          width: fullMeta.width ?? meta.width ?? null,
          height: fullMeta.height ?? meta.height ?? null,
        },
        thumbnail: { buffer: thumbnail, contentType: 'image/webp' },
        fellBack: false,
      };
    } catch (err) {
      // Unsupported codec (often HEIC without libheif) — keep the original.
      this.logger.warn(
        `Image optimization failed (${mimeType}); storing original: ${(err as Error).message}`,
      );
      return {
        full: { buffer: original, contentType: mimeType, width: null, height: null },
        thumbnail: null,
        fellBack: true,
      };
    }
  }
}
