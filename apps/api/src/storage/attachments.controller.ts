import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { AttachmentOwner } from '@prisma/client';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { nanoid } from 'nanoid';
import { StorageService } from './storage.service';

class PresignDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  contentType!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fileName!: string;
}

@ApiTags('Storage')
@ApiBearerAuth('access')
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('presign')
  async presign(@CurrentUser() user: AuthenticatedUser, @Body() dto: PresignDto) {
    const key = `uploads/${user.id}/${Date.now()}-${nanoid(8)}-${dto.fileName}`;
    const upload = await this.storage.presignUpload({ key, contentType: dto.contentType });

    const attachment = await this.prisma.attachment.create({
      data: {
        bucket: upload.bucket,
        key: upload.key,
        mimeType: dto.contentType,
        size: 0,
        ownerKind: AttachmentOwner.GENERIC,
        uploadedByUserId: user.id,
      },
    });

    return { ...upload, attachmentId: attachment.id };
  }
}
