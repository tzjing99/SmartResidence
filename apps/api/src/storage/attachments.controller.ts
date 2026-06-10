import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AttachmentOwner, AttachmentStatus, RoleId, TranscodeStatus } from '@prisma/client';
import {
  DEFAULT_OUTPUT_FORMAT,
  MAX_UPLOAD_BYTES,
  OUTPUT_FORMAT_MIME,
  type OutputImageFormat,
  isAllowedImageMime,
  isOutputImageFormat,
  sanitizeFileName,
} from '@smartresidence/shared-types';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import { nanoid } from 'nanoid';
import { StorageService } from './storage.service';

const MANAGEMENT_ROLES: RoleId[] = [
  RoleId.SUPER_ADMIN,
  RoleId.MANAGEMENT_ADMIN,
  RoleId.MANAGEMENT_STAFF,
];

/** Attachment bytes are immutable for a given id — cache aggressively. */
const IMMUTABLE_CACHE = 'private, max-age=31536000, immutable';

class PresignDto {
  @ApiProperty({ description: 'MIME type of the file (must be an allowed image type).' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  contentType!: string;

  @ApiProperty({ description: 'Original file name (used for the storage key suffix).' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;

  @ApiPropertyOptional({ description: 'File size in bytes (validated against the max).' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  size?: number;
}

@ApiTags('Storage')
@ApiBearerAuth('access')
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Legacy presigned PUT flow (used by the visitor plate-photo capture).
   * The client uploads bytes directly to object storage. Records created
   * here are COMMITTED immediately because they are referenced by their
   * parent record (e.g. visitor.vehiclePlatePhotoUrl) rather than via the
   * attachment association used by messages.
   */
  @Post('presign')
  async presign(@CurrentUser() user: AuthenticatedUser, @Body() dto: PresignDto) {
    if (!isAllowedImageMime(dto.contentType)) {
      throw new BadRequestException(`Unsupported file type: ${dto.contentType}`);
    }
    if (dto.size !== undefined && dto.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File is too large (max 15 MB).');
    }

    const safeName = sanitizeFileName(dto.fileName);
    const key = `uploads/${user.id}/${Date.now()}-${nanoid(8)}-${safeName}`;
    const upload = await this.storage.presignUpload({ key, contentType: dto.contentType });

    const attachment = await this.prisma.attachment.create({
      data: {
        bucket: upload.bucket,
        key: upload.key,
        mimeType: dto.contentType,
        size: dto.size ?? 0,
        status: AttachmentStatus.COMMITTED,
        ownerKind: AttachmentOwner.GENERIC,
        uploadedByUserId: user.id,
      },
    });

    return { ...upload, attachmentId: attachment.id };
  }

  /**
   * Stream the full image. `?format=avif|webp` selects the variant; defaults to
   * AVIF and falls back to WebP / the original when the requested variant is
   * missing or the transcode isn't READY yet. `format` is part of the cache key
   * via the query string, so the immutable cache header stays correct.
   */
  @Get(':id/raw')
  @ApiQuery({ name: 'format', required: false, enum: ['avif', 'webp'] })
  async raw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('format') format?: string,
  ): Promise<void> {
    const attachment = await this.authorize(user, id);
    const fileName =
      attachment.mimeType === 'application/pdf' ? this.pdfFileName(attachment.metadata) : undefined;
    const resolved = this.resolveVariant(attachment, 'raw', this.parseFormat(format));
    await this.streamKey(res, resolved.key, resolved.contentType, fileName);
  }

  /** Stream the thumbnail derivative (falls back to the full image). */
  @Get(':id/thumb')
  @ApiQuery({ name: 'format', required: false, enum: ['avif', 'webp'] })
  async thumb(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('format') format?: string,
  ): Promise<void> {
    const attachment = await this.authorize(user, id);
    const resolved = this.resolveVariant(attachment, 'thumb', this.parseFormat(format));
    await this.streamKey(res, resolved.key, resolved.contentType);
  }

  private parseFormat(format?: string): OutputImageFormat {
    return isOutputImageFormat(format) ? format : DEFAULT_OUTPUT_FORMAT;
  }

  /**
   * Resolve the storage key + content-type for a requested variant/format,
   * gracefully falling back: AVIF (when READY) → WebP fallback → original/inline.
   */
  private resolveVariant(
    attachment: {
      key: string;
      thumbnailKey: string | null;
      mimeType: string;
      format: string | null;
      fallbackKey: string | null;
      fallbackMimeType: string | null;
      fallbackThumbnailKey: string | null;
      transcodeStatus: TranscodeStatus;
    },
    variant: 'raw' | 'thumb',
    format: OutputImageFormat,
  ): { key: string; contentType: string } {
    const ready = attachment.transcodeStatus === TranscodeStatus.READY;

    if (variant === 'thumb') {
      if (format === 'webp' && attachment.fallbackThumbnailKey) {
        return { key: attachment.fallbackThumbnailKey, contentType: OUTPUT_FORMAT_MIME.webp };
      }
      if (format === 'avif' && ready && attachment.format === 'avif' && attachment.thumbnailKey) {
        return { key: attachment.thumbnailKey, contentType: OUTPUT_FORMAT_MIME.avif };
      }
      // Fall back to the WebP thumb, then any thumbnail, then the full image.
      if (attachment.fallbackThumbnailKey) {
        return { key: attachment.fallbackThumbnailKey, contentType: OUTPUT_FORMAT_MIME.webp };
      }
      if (attachment.thumbnailKey) {
        return { key: attachment.thumbnailKey, contentType: OUTPUT_FORMAT_MIME.webp };
      }
      return { key: attachment.key, contentType: attachment.mimeType };
    }

    // variant === 'raw'
    if (format === 'webp' && attachment.fallbackKey) {
      return {
        key: attachment.fallbackKey,
        contentType: attachment.fallbackMimeType ?? OUTPUT_FORMAT_MIME.webp,
      };
    }
    if (format === 'avif' && ready && attachment.format === 'avif') {
      return { key: attachment.key, contentType: OUTPUT_FORMAT_MIME.avif };
    }
    if (attachment.fallbackKey) {
      return {
        key: attachment.fallbackKey,
        contentType: attachment.fallbackMimeType ?? OUTPUT_FORMAT_MIME.webp,
      };
    }
    return { key: attachment.key, contentType: attachment.mimeType };
  }

  private async streamKey(
    res: Response,
    key: string,
    contentType: string,
    downloadName?: string,
  ): Promise<void> {
    try {
      const stat = await this.storage.statObject(key).catch(() => null);
      const stream = await this.storage.getObjectStream(key);
      res.setHeader('Content-Type', stat?.contentType ?? contentType);
      res.setHeader('Cache-Control', IMMUTABLE_CACHE);
      // Bytes differ by the `?format=` query (and potentially Accept), so make
      // caches vary on Accept as defense-in-depth.
      res.setHeader('Vary', 'Accept');
      if (downloadName) {
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${downloadName.replace(/"/g, '')}"`,
        );
      }
      if (stat?.size) res.setHeader('Content-Length', String(stat.size));
      stream.on('error', () => {
        if (!res.headersSent) res.status(404).end();
        else res.end();
      });
      stream.pipe(res);
    } catch {
      if (!res.headersSent) res.status(404).end();
    }
  }

  private async authorize(user: AuthenticatedUser, id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        threadMessage: { include: { thread: true } },
        announcement: {
          include: {
            audienceBlocks: { select: { blockId: true } },
            audienceUnits: { select: { unitId: true } },
          },
        },
      },
    });
    if (!attachment) throw new NotFoundException();

    const isUploader = attachment.uploadedByUserId === user.id;
    const thread = attachment.threadMessage?.thread ?? null;
    const canViewThread = thread ? this.canViewThread(user, thread) : false;
    const canViewAnnouncement = attachment.announcement
      ? await this.canViewAnnouncement(user, attachment.announcement)
      : false;
    if (!isUploader && !canViewThread && !canViewAnnouncement) throw new ForbiddenException();
    return attachment;
  }

  private pdfFileName(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== 'object') return undefined;
    const name = (metadata as { fileName?: unknown }).fileName;
    return typeof name === 'string' ? name : 'document.pdf';
  }

  private async canViewAnnouncement(
    user: AuthenticatedUser,
    announcement: {
      condoId: string;
      publishedAt: Date | null;
      expiresAt: Date | null;
      deletedAt: Date | null;
      audienceScope: 'CONDO' | 'BLOCKS' | 'UNITS';
      audienceBlocks: { blockId: string }[];
      audienceUnits: { unitId: string }[];
    },
  ): Promise<boolean> {
    if (announcement.deletedAt) return false;
    const mgmtRoles = user.roles.filter((r) => MANAGEMENT_ROLES.includes(r.roleId));
    if (mgmtRoles.some((r) => r.condoId === announcement.condoId)) return true;

    const now = new Date();
    if (!announcement.publishedAt || announcement.publishedAt > now) return false;
    if (announcement.expiresAt && announcement.expiresAt <= now) return false;

    const unitIds = user.roles.map((r) => r.unitId).filter(Boolean) as string[];
    if (announcement.audienceScope === 'CONDO') return unitIds.length > 0;

    if (announcement.audienceScope === 'UNITS') {
      return announcement.audienceUnits.some((u) => unitIds.includes(u.unitId));
    }

    if (unitIds.length === 0) return false;
    const units = await this.prisma.unit.findMany({
      where: { id: { in: unitIds }, condoId: announcement.condoId },
      select: { blockId: true },
    });
    const blockIds = units.map((u) => u.blockId);
    return announcement.audienceBlocks.some((b) => blockIds.includes(b.blockId));
  }

  private canViewThread(
    user: AuthenticatedUser,
    thread: { condoId: string; createdByUserId: string | null; unitId: string | null },
  ): boolean {
    const mgmtRoles = user.roles.filter((r) => MANAGEMENT_ROLES.includes(r.roleId));
    if (mgmtRoles.length > 0) {
      return mgmtRoles.some((r) => r.condoId === thread.condoId);
    }
    if (thread.createdByUserId === user.id) return true;
    if (thread.unitId && user.roles.some((r) => r.unitId === thread.unitId)) return true;
    return false;
  }
}
