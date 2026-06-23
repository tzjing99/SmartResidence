import { readFile } from 'node:fs/promises';
import { unlink } from 'node:fs/promises';
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
import { AttachmentOwner, AttachmentStatus } from '@prisma/client';
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  type UploadResponse,
  isAllowedDocumentMime,
  isAllowedImageMime,
  sanitizeFileName,
} from '@smartresidence/shared-types';
import { diskStorage } from 'multer';
import { nanoid } from 'nanoid';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@ApiBearerAuth('access')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly storage: StorageService,
    private readonly images: ImageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Streamed multipart upload. Multer writes the incoming stream to a temp
   * file on disk (never buffering the whole file in memory) and aborts early
   * once the size limit is exceeded. The file is then optimized + a thumbnail
   * is generated before the derivatives are stored. The attachment starts in
   * PENDING state and is committed when the parent message/record is sent.
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
      if (isAllowedDocumentMime(file.mimetype)) {
        if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
          throw new BadRequestException('PDF is too large (max 25 MB).');
        }
        const buffer = await readFile(tempPath);
        const safeName = sanitizeFileName(file.originalname);
        const prefix = `uploads/${user.id}/${Date.now()}-${nanoid(8)}`;
        const fullKey = `${prefix}-${safeName.replace(/\.pdf$/i, '')}.pdf`;

        await this.storage.putObject({
          key: fullKey,
          body: buffer,
          contentType: 'application/pdf',
        });

        const attachment = await this.prisma.attachment.create({
          data: {
            bucket: this.storage.bucketName(),
            key: fullKey,
            mimeType: 'application/pdf',
            size: buffer.length,
            status: AttachmentStatus.PENDING,
            ownerKind: AttachmentOwner.GENERIC,
            uploadedByUserId: user.id,
            metadata: { fileName: file.originalname },
          },
        });

        return {
          attachmentId: attachment.id,
          key: attachment.key,
          thumbnailKey: null,
          mimeType: attachment.mimeType,
          size: attachment.size,
          width: null,
          height: null,
          status: 'PENDING',
        };
      }

      if (!isAllowedImageMime(file.mimetype)) {
        throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
      }

      const processed = await this.images.process(tempPath, file.mimetype);
      const safeName = sanitizeFileName(file.originalname);
      const prefix = `uploads/${user.id}/${Date.now()}-${nanoid(8)}`;
      const fullExt = extFor(processed.full.contentType);
      const fullKey = `${prefix}-${safeName}.${fullExt}`;

      await this.storage.putObject({
        key: fullKey,
        body: processed.full.buffer,
        contentType: processed.full.contentType,
      });

      let thumbnailKey: string | null = null;
      if (processed.thumbnail) {
        thumbnailKey = `${prefix}-thumb.${extFor(processed.thumbnail.contentType)}`;
        await this.storage.putObject({
          key: thumbnailKey,
          body: processed.thumbnail.buffer,
          contentType: processed.thumbnail.contentType,
        });
      }

      const attachment = await this.prisma.attachment.create({
        data: {
          bucket: this.storage.bucketName(),
          key: fullKey,
          thumbnailKey,
          mimeType: processed.full.contentType,
          size: processed.full.buffer.length,
          width: processed.full.width,
          height: processed.full.height,
          status: AttachmentStatus.PENDING,
          ownerKind: AttachmentOwner.GENERIC,
          uploadedByUserId: user.id,
        },
      });

      return {
        attachmentId: attachment.id,
        key: attachment.key,
        thumbnailKey: attachment.thumbnailKey,
        mimeType: attachment.mimeType,
        size: attachment.size,
        width: attachment.width,
        height: attachment.height,
        status: 'PENDING',
      };
    } finally {
      // Always free the temp file, whether we succeeded or threw.
      await unlink(tempPath).catch(() => undefined);
    }
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
