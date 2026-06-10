import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AnnouncementAudienceScope,
  AnnouncementCategory,
  AnnouncementImportance,
} from '@prisma/client';
import { Type } from 'class-transformer';
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
} from 'class-validator';

export class ListAnnouncementsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AnnouncementCategory })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;
}

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty({ minLength: 4, maxLength: 200 })
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Markdown body' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ enum: AnnouncementCategory })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;

  @ApiPropertyOptional({ enum: AnnouncementImportance })
  @IsOptional()
  @IsEnum(AnnouncementImportance)
  importance?: AnnouncementImportance;

  @ApiPropertyOptional({ enum: AnnouncementAudienceScope })
  @IsOptional()
  @IsEnum(AnnouncementAudienceScope)
  audienceScope?: AnnouncementAudienceScope;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  blockIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresAck?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ minLength: 4, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @ApiPropertyOptional({ enum: AnnouncementCategory })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;

  @ApiPropertyOptional({ enum: AnnouncementImportance })
  @IsOptional()
  @IsEnum(AnnouncementImportance)
  importance?: AnnouncementImportance;

  @ApiPropertyOptional({ enum: AnnouncementAudienceScope })
  @IsOptional()
  @IsEnum(AnnouncementAudienceScope)
  audienceScope?: AnnouncementAudienceScope;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  blockIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresAck?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  @ApiPropertyOptional({
    description: 'Re-send notifications after editing a published announcement',
  })
  @IsOptional()
  @IsBoolean()
  republish?: boolean;
}
