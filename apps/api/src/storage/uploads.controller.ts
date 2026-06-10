import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AttachmentOwner, AttachmentStatus, TranscodeStatus } from '@prisma/client';
import {
  DEFAULT_OUTPUT_FORMAT,
  MAX_DOCUMENT_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  type UploadResponse,
  isAllowedDocumentMime,
  isAllowedImageMime,
  sanitizeFileName,
  sniffMimeType,
} from '@smartresidence/shared-types';
import { diskStorage } from 'multer';
import { nanoid } from 'nanoid';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';
import { TranscodeQueue } from './transcode.queue';

@ApiTags('Storage')
@ApiBearerAuth('access')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly storage: StorageService,
    private readonly images: ImageService,
    private readonly prisma: PrismaService,
    private readonly transcodeQueue: TranscodeQueue,
  ) {}

  /**
   * Streamed multipart upload. Multer writes the incoming stream to a temp
   * file on disk (never buffering the whole file in memory) and aborts early
   * once the size limit is exceeded. Images are optimized + thumbnailed;
   * PDFs are stored as-is for announcement attachments.
   */
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, _file, cb) => cb(null, `sr-upload-${Date.now()}-${nanoid(10)}`),
      }),
      limits: { fileSize: MAX_DOCUMENT_UPLOAD_BYTES, files: 1 },
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadResponse> {
    if (!file) throw new BadRequestException('No file provided');

    const tempPath = file.path ?? join(tmpdir(), file.filename);
    try {
      const original = await readFile(tempPath);

      // Magic-byte sniff (never trust the declared Content-Type). Reconcile the
      // detected type against the allowlists below.
      const sniffed = sniffMimeType(original.subarray(0, 16));

      if (isAllowedDocumentMime(file.mimetype)) {
        if (sniffed !== 'application/pdf') {
          throw new BadRequestException('File content does not match a PDF.');
        }
        if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
          throw new BadRequestException('PDF is too large (max 25 MB).');
        }
        return this.uploadPdf(user, file, original);
      }

      if (!isAllowedImageMime(file.mimetype)) {
        throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
      }
      if (!isAllowedImageMime(sniffed)) {
        throw new BadRequestException('File content is not a supported image.');
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new BadRequestException('Image is too large (max 15 MB).');
      }

      // Trust the sniffed type over the declared one for downstream decoding.
      const effectiveMime = sniffed;
      const safeName = sanitizeFileName(file.originalname);
      const prefix = `uploads/${user.id}/${Date.now()}-${nanoid(8)}`;

      // Cheap inline WebP thumbnail so the UI isn't blank while the full AVIF
      // set transcodes in the background.
      const inline = await this.images.makeInlineThumbnail(original, effectiveMime);

      // GIFs are passthrough (animation preserved) — store as-is, no transcode.
      if (this.images.isPassthrough(effectiveMime)) {
        const gifKey = `${prefix}-${safeName}.gif`;
        await this.storage.putObject({ key: gifKey, body: original, contentType: effectiveMime });
        const attachment = await this.prisma.attachment.create({
          data: {
            bucket: this.storage.bucketName(),
            key: gifKey,
            thumbnailKey: null,
            mimeType: effectiveMime,
            size: original.length,
            width: inline.width,
            height: inline.height,
            status: AttachmentStatus.PENDING,
            transcodeStatus: TranscodeStatus.SKIPPED,
            format: 'gif',
            ownerKind: AttachmentOwner.GENERIC,
            uploadedByUserId: user.id,
          },
        });
        return this.toResponse(attachment);
      }

      // Store the original temporarily for the worker to read; deleted on READY.
      const originalKey = `${prefix}-original.${extFor(effectiveMime)}`;
      await this.storage.putObject({
        key: originalKey,
        body: original,
        contentType: effectiveMime,
      });

      // Inline thumb shares the final WebP-thumb key so the worker overwrites
      // it in place (no orphan). May be null if the host can't decode (HEIC dev).
      let thumbnailKey: string | null = null;
      if (inline.thumbnail) {
        thumbnailKey = `${prefix}-thumb.webp`;
        await this.storage.putObject({
          key: thumbnailKey,
          body: inline.thumbnail.buffer,
          contentType: inline.thumbnail.contentType,
        });
      }

      const attachment = await this.prisma.attachment.create({
        data: {
          bucket: this.storage.bucketName(),
          // During PENDING `key` points at the original; the worker flips it to
          // the AVIF display key on READY.
          key: originalKey,
          thumbnailKey,
          mimeType: effectiveMime,
          size: original.length,
          width: inline.width,
          height: inline.height,
          status: AttachmentStatus.PENDING,
          transcodeStatus: TranscodeStatus.PENDING,
          format: DEFAULT_OUTPUT_FORMAT,
          ownerKind: AttachmentOwner.GENERIC,
          uploadedByUserId: user.id,
        },
      });

      await this.transcodeQueue.enqueue({
        attachmentId: attachment.id,
        bucket: this.storage.bucketName(),
        originalKey,
        prefix,
        safeName,
        mimeType: effectiveMime,
      });

      return this.toResponse(attachment);
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
  }

  private toResponse(attachment: {
    id: string;
    key: string;
    thumbnailKey: string | null;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
    format: string | null;
    transcodeStatus: TranscodeStatus;
  }): UploadResponse {
    return {
      attachmentId: attachment.id,
      key: attachment.key,
      thumbnailKey: attachment.thumbnailKey,
      mimeType: attachment.mimeType,
      size: attachment.size,
      width: attachment.width,
      height: attachment.height,
      status: 'PENDING',
      format: attachment.format,
      transcodeStatus: attachment.transcodeStatus,
    };
  }

  private async uploadPdf(
    user: AuthenticatedUser,
    file: Express.Multer.File,
    body: Buffer,
  ): Promise<UploadResponse> {
    const safeName = sanitizeFileName(file.originalname);
    const prefix = `uploads/${user.id}/${Date.now()}-${nanoid(8)}`;
    const key = `${prefix}-${safeName}.pdf`;

    await this.storage.putObject({
      key,
      body,
      contentType: 'application/pdf',
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        bucket: this.storage.bucketName(),
        key,
        thumbnailKey: null,
        mimeType: 'application/pdf',
        size: body.length,
        width: null,
        height: null,
        status: AttachmentStatus.PENDING,
        transcodeStatus: TranscodeStatus.SKIPPED,
        ownerKind: AttachmentOwner.GENERIC,
        uploadedByUserId: user.id,
        metadata: { fileName: file.originalname },
      },
    });

    return this.toResponse(attachment);
  }
}

function extFor(contentType: string): string {
  switch (contentType) {
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'bin';
  }
}
