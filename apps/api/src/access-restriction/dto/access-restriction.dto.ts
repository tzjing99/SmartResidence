import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const ZONES = ['CAR_PARK', 'AMENITIES', 'COMMON_FACILITIES'] as const;

export class UpdateAccessRestrictionSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  graceDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOutstanding?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  softBlockFacility?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  softBlockVisitors?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  softBlockDeliveryPasses?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  softBlockRecurringPasses?: boolean;

  @ApiPropertyOptional({ isArray: true, enum: ZONES })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(ZONES, { each: true })
  zones?: Array<(typeof ZONES)[number]>;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsUrl({ require_tld: false })
  webhookUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  webhookSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSyncEnabled?: boolean;
}

export class ManualRestrictDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
