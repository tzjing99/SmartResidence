import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DefectSeverity, DefectStatus } from '@prisma/client';

export class CreateDefectDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ minLength: 4, maxLength: 120 })
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ minLength: 10, maxLength: 4000 })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiProperty()
  @IsString()
  category!: string;

  @ApiPropertyOptional({ enum: DefectSeverity, default: DefectSeverity.MEDIUM })
  @IsOptional()
  @IsEnum(DefectSeverity)
  severity?: DefectSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Pre-uploaded attachment ids', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}

export class TransitionDefectDto {
  @ApiProperty({ enum: DefectStatus })
  @IsEnum(DefectStatus)
  status!: DefectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}

export class AddDefectUpdateDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  isInternal?: boolean;
}
