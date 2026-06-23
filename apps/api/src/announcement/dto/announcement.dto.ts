import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AnnouncementAudienceScope,
  AnnouncementCategory,
  AnnouncementImportance,
} from '@prisma/client';
import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty({ minLength: 4, maxLength: 200 })
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Markdown summary — what residents need to know' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ enum: AnnouncementImportance })
  @IsOptional()
  @IsEnum(AnnouncementImportance)
  importance?: AnnouncementImportance;

  @ApiPropertyOptional({ enum: AnnouncementCategory })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;

  @ApiPropertyOptional({ enum: AnnouncementAudienceScope, default: AnnouncementAudienceScope.CONDO })
  @IsOptional()
  @IsEnum(AnnouncementAudienceScope)
  audienceScope?: AnnouncementAudienceScope;

  @ApiPropertyOptional({ type: [String], description: 'Required when audienceScope is BLOCKS' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  blockIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Required when audienceScope is UNITS' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresAck?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({ description: 'Pre-uploaded attachment ids (PDF memo and/or images)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}

export class ListAnnouncementsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Include drafts and unpublished (management only)' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  manage?: boolean;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Set to null to unpublish (revert to draft); a date to publish/schedule',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}
