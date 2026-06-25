import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DefectStatus } from '@prisma/client';
import { HANDOVER_REPORT_ITEMS_HARD_CAP } from '@smartresidence/shared-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class HandoverReportItemDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  spaceLabel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  spaceTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  elementId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  issueId?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  elementName?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  issueName?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ type: [String], description: 'Pre-uploaded attachment ids' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMaxSize(10)
  attachmentIds?: string[];
}

export class CreateHandoverReportDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiPropertyOptional({ minLength: 3, maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @ApiProperty({ type: [HandoverReportItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(HANDOVER_REPORT_ITEMS_HARD_CAP)
  @ValidateNested({ each: true })
  @Type(() => HandoverReportItemDto)
  items!: HandoverReportItemDto[];
}

export class BulkUpdateReportItemsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(HANDOVER_REPORT_ITEMS_HARD_CAP)
  defectIds!: string[];

  @ApiPropertyOptional({ enum: DefectStatus })
  @IsOptional()
  @IsEnum(DefectStatus)
  status?: DefectStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  assignedToUserId?: string | null;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
