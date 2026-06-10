import { Injectable, Logger } from '@nestjs/common';
import {
  AVIF_DISPLAY_OPTS,
  AVIF_THUMB_OPTS,
  IMAGE_MAX_DIMENSION,
  THUMBNAIL_MAX_DIMENSION,
  WEBP_DISPLAY_OPTS,
  WEBP_THUMB_OPTS,
} from '@smartresidence/shared-types';
import sharp from 'sharp';

export interface ImageVariant {
  buffer: Buffer;
  contentType: string;
  width: number | null;
  height: number | null;
}

/** Cheap, immediately-viewable derivative generated inline on the request path. */
export interface InlineThumbResult {
  thumbnail: {
    buffer: Buffer;
    contentType: string;
    width: number | null;
    height: number | null;
  } | null;
  /** Source dimensions (best-effort) for the Attachment row. */
  width: number | null;
  height: number | null;
  /**
   * True when the input is a passthrough type (GIF) or sharp could not decode
   * it (e.g. HEIC without libheif). In that case there is no inline thumbnail
   * and the full transcode is expected to be SKIPPED.
   */
  passthrough: boolean;
}

/** Full AVIF + WebP variant set produced by the background transcode worker. */
export interface TranscodeResult {
  displayAvif: ImageVariant;
  thumbAvif: ImageVariant;
  displayWebp: ImageVariant;
  thumbWebp: ImageVariant;
}

// Animated GIFs are stored as-is so we don't flatten the animation.
const PASSTHROUGH_MIME = new Set(['image/gif']);

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  isPassthrough(mimeType: string): boolean {
    return PASSTHROUGH_MIME.has(mimeType.toLowerCase());
  }

  /**
   * Request-path work only: produce a small WebP thumbnail so the UI isn't
   * blank while the full AVIF set transcodes in the background. Cheap by design
   * (low effort, small dimension). Never throws — undecodable / passthrough
   * inputs return `passthrough: true` with no thumbnail.
   */
  async makeInlineThumbnail(original: Buffer, mimeType: string): Promise<InlineThumbResult> {
    if (this.isPassthrough(mimeType)) {
      return { thumbnail: null, width: null, height: null, passthrough: true };
    }

    try {
      const meta = await sharp(original, { failOn: 'none' }).metadata();

      const thumb = await sharp(original, { failOn: 'none' })
        .rotate()
        .resize({
          width: THUMBNAIL_MAX_DIMENSION,
          height: THUMBNAIL_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .withMetadata()
        .webp({ ...WEBP_THUMB_OPTS })
        .toBuffer();

      const thumbMeta = await sharp(thumb).metadata();
      return {
        thumbnail: {
          buffer: thumb,
          contentType: 'image/webp',
          width: thumbMeta.width ?? null,
          height: thumbMeta.height ?? null,
        },
        width: meta.width ?? null,
        height: meta.height ?? null,
        passthrough: false,
      };
    } catch (err) {
      // Unsupported codec (often HEIC without libheif) — the worker will SKIP.
      this.logger.warn(
        `Inline thumbnail failed (${mimeType}); deferring to passthrough: ${(err as Error).message}`,
      );
      return { thumbnail: null, width: null, height: null, passthrough: true };
    }
  }

  /**
   * Background work: generate the full variant set from the original bytes —
   * AVIF display + AVIF thumb (primary) and WebP display + WebP thumb
   * (fallback). Metadata (EXIF/GPS) is intentionally PRESERVED via
   * `.withMetadata()` because the original is discarded after transcode, so the
   * derivatives are the only copy.
   *
   * Returns `null` when the input is passthrough (GIF) or sharp cannot decode
   * it (HEIC without libheif) — the caller marks the attachment SKIPPED and
   * keeps the original.
   */
  async transcode(original: Buffer, mimeType: string): Promise<TranscodeResult | null> {
    if (this.isPassthrough(mimeType)) return null;

    try {
      const displayAvif = await this.encode(
        original,
        'avif',
        IMAGE_MAX_DIMENSION,
        AVIF_DISPLAY_OPTS,
      );
      const thumbAvif = await this.encode(
        original,
        'avif',
        THUMBNAIL_MAX_DIMENSION,
        AVIF_THUMB_OPTS,
      );
      const displayWebp = await this.encode(
        original,
        'webp',
        IMAGE_MAX_DIMENSION,
        WEBP_DISPLAY_OPTS,
      );
      const thumbWebp = await this.encode(
        original,
        'webp',
        THUMBNAIL_MAX_DIMENSION,
        WEBP_THUMB_OPTS,
      );
      return { displayAvif, thumbAvif, displayWebp, thumbWebp };
    } catch (err) {
      this.logger.warn(
        `Transcode failed (${mimeType}); keeping original: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async encode(
    original: Buffer,
    format: 'avif' | 'webp',
    maxDimension: number,
    opts: Record<string, unknown>,
  ): Promise<ImageVariant> {
    let pipeline = sharp(original, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .withMetadata();

    pipeline = format === 'avif' ? pipeline.avif({ ...opts }) : pipeline.webp({ ...opts });

    const buffer = await pipeline.toBuffer();
    const meta = await sharp(buffer).metadata();
    return {
      buffer,
      contentType: format === 'avif' ? 'image/avif' : 'image/webp',
      width: meta.width ?? null,
      height: meta.height ?? null,
    };
  }
}
