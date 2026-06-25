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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { AttachmentOwner, AttachmentStatus, RoleId } from '@prisma/client';
import {
  MAX_UPLOAD_BYTES,
  isAllowedImageMime,
  isPdfMime,
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

  /** Stream the full optimized image with immutable cache headers. */
  @Get(':id/raw')
  async raw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const attachment = await this.authorize(user, id);
    const disposition = isPdfMime(attachment.mimeType) ? 'inline' : undefined;
    await this.streamKey(res, attachment.key, attachment.mimeType, disposition, attachment);
  }

  /** Stream the thumbnail derivative (falls back to the full image). */
  @Get(':id/thumb')
  async thumb(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const attachment = await this.authorize(user, id);
    const key = attachment.thumbnailKey ?? attachment.key;
    const contentType = attachment.thumbnailKey ? 'image/webp' : attachment.mimeType;
    await this.streamKey(res, key, contentType);
  }

  private async streamKey(
    res: Response,
    key: string,
    contentType: string,
    disposition?: 'inline' | 'attachment',
    attachment?: { metadata: unknown; mimeType: string },
  ): Promise<void> {
    try {
      const stat = await this.storage.statObject(key).catch(() => null);
      const stream = await this.storage.getObjectStream(key);
      res.setHeader('Content-Type', stat?.contentType ?? contentType);
      res.setHeader('Cache-Control', IMMUTABLE_CACHE);
      if (stat?.size) res.setHeader('Content-Length', String(stat.size));
      if (disposition && attachment) {
        const fileName = this.fileNameFromMetadata(attachment);
        if (fileName) {
          res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
        }
      }
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
        announcement: { select: { id: true, condoId: true, deletedAt: true } },
        defect: { select: { condoId: true, unitId: true } },
        defectUpdate: { select: { defect: { select: { condoId: true, unitId: true } } } },
      },
    });
    if (!attachment) throw new NotFoundException();

    const isUploader = attachment.uploadedByUserId === user.id;
    const thread = attachment.threadMessage?.thread ?? null;
    const canViewThread = thread ? this.canViewThread(user, thread) : false;
    const canViewAnnouncement =
      attachment.announcement && !attachment.announcement.deletedAt
        ? this.canViewCondoAnnouncement(user, attachment.announcement.condoId)
        : false;
    // Defect / handover photos: management (condo-scoped) and the unit's
    // residents may view, not just the uploader, so triage thumbnails resolve.
    const defectScope = attachment.defect ?? attachment.defectUpdate?.defect ?? null;
    const canViewDefect = defectScope ? this.canViewDefect(user, defectScope) : false;
    if (!isUploader && !canViewThread && !canViewAnnouncement && !canViewDefect) {
      throw new ForbiddenException();
    }
    return attachment;
  }

  private canViewDefect(
    user: AuthenticatedUser,
    defect: { condoId: string; unitId: string | null },
  ): boolean {
    const isManagement = user.roles.some(
      (r) => MANAGEMENT_ROLES.includes(r.roleId) && r.condoId === defect.condoId,
    );
    if (isManagement) return true;
    if (defect.unitId && user.roles.some((r) => r.unitId === defect.unitId)) return true;
    return false;
  }

  private canViewCondoAnnouncement(user: AuthenticatedUser, condoId: string): boolean {
    return user.roles.some((r) => r.condoId === condoId);
  }

  private fileNameFromMetadata(attachment: { metadata: unknown; mimeType: string }): string | null {
    const raw = attachment.metadata;
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'fileName' in raw) {
      const name = String((raw as { fileName?: unknown }).fileName ?? '').trim();
      if (name) return name;
    }
    return isPdfMime(attachment.mimeType) ? 'memo.pdf' : null;
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
