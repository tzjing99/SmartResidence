import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AnnouncementImportance } from '@prisma/client';

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
  body!: string;

  @ApiPropertyOptional({ enum: AnnouncementImportance })
  @IsOptional()
  @IsEnum(AnnouncementImportance)
  importance?: AnnouncementImportance;

  @ApiPropertyOptional({ description: 'Audience filter (e.g. { blocks: [\"A\"] })' })
  @IsOptional()
  @IsObject()
  audience?: Record<string, unknown>;

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
}
