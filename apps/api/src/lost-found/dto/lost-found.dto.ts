import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LostFoundKind, LostFoundStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLostFoundPostDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ enum: LostFoundKind })
  @IsEnum(LostFoundKind)
  kind!: LostFoundKind;

  @ApiProperty({ minLength: 3, maxLength: 120 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationNote?: string;

  @ApiProperty({ description: 'How others can reach you (phone, email, lobby, etc.)' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  contactMethod!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  photoAttachmentId?: string;
}

export class ListLostFoundPostsDto {
  @ApiPropertyOptional({ enum: LostFoundKind })
  @IsOptional()
  @IsEnum(LostFoundKind)
  kind?: LostFoundKind;

  @ApiPropertyOptional({ enum: LostFoundStatus })
  @IsOptional()
  @IsEnum(LostFoundStatus)
  status?: LostFoundStatus;

  @ApiPropertyOptional({ description: 'Residents: only open posts on the board' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : undefined))
  openOnly?: boolean;

  @ApiPropertyOptional({ description: 'Management view including removed/resolved' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : undefined))
  manage?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
