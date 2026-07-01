import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeeRateType, FeeScheduleLineRateType, LedgerFund } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpsertFeeRateDto {
  @ApiProperty()
  @IsUUID()
  unitTypeId!: string;

  @ApiProperty({ enum: FeeRateType })
  @IsEnum(FeeRateType)
  maintenanceRateType!: FeeRateType;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  maintenanceAmount!: number;

  @ApiProperty({ enum: FeeRateType })
  @IsEnum(FeeRateType)
  sinkingFundRateType!: FeeRateType;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  sinkingFundAmount!: number;
}

export class UpsertFeeScheduleExtraLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'FIRE' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Fire insurance premium' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: 'FIRE_INSURANCE' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    enum: [LedgerFund.MAINTENANCE, LedgerFund.SINKING_FUND, LedgerFund.DEPOSIT],
    description: 'Ledger fund for invoice generation (Strata Act fund separation).',
  })
  @IsIn([LedgerFund.MAINTENANCE, LedgerFund.SINKING_FUND, LedgerFund.DEPOSIT])
  fund!: LedgerFund;

  @ApiPropertyOptional({ description: 'Shown on invoice for resident transparency.' })
  @IsOptional()
  @IsString()
  formula?: string;

  @ApiProperty({ enum: FeeScheduleLineRateType })
  @IsEnum(FeeScheduleLineRateType)
  rateType!: FeeScheduleLineRateType;

  @ApiPropertyOptional({ minimum: 0, description: 'Flat amount or per-sqft rate.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Amounts keyed by unitTypeId when rateType is PER_UNIT_TYPE.',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  unitTypeAmounts?: Record<string, number>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveFrom?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveTo?: Date | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class AddFeeSchedulePresetsDto {
  @ApiPropertyOptional({
    description: 'Billing month in YYYY-MM form. Omit when adding recurring preset lines.',
  })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Preset categories to add. Defaults to common Malaysian strata fees.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  presetCodes?: string[];
}
