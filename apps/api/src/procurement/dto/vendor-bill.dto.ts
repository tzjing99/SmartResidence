import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LedgerFund, VendorBillStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const VENDOR_BILL_FUNDS = [LedgerFund.MAINTENANCE, LedgerFund.SINKING_FUND, LedgerFund.GENERAL];

export class CreateVendorBillDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty()
  @IsUUID()
  vendorId!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  billNumber!: string;

  @ApiProperty({ description: 'ISO date (YYYY-MM-DD)' })
  @IsDateString()
  billDate!: string;

  @ApiProperty({ description: 'ISO date (YYYY-MM-DD)' })
  @IsDateString()
  dueDate!: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: VENDOR_BILL_FUNDS })
  @IsEnum(LedgerFund)
  fund!: LedgerFund;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  attachmentId?: string;
}

export class UpdateVendorBillDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  billNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  billDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ enum: VENDOR_BILL_FUNDS })
  @IsOptional()
  @IsEnum(LedgerFund)
  fund?: LedgerFund;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  attachmentId?: string;
}

export class ListVendorBillsDto {
  @ApiPropertyOptional({ enum: VendorBillStatus })
  @IsOptional()
  @IsEnum(VendorBillStatus)
  status?: VendorBillStatus;

  @ApiPropertyOptional({ enum: VENDOR_BILL_FUNDS })
  @IsOptional()
  @IsEnum(LedgerFund)
  fund?: LedgerFund;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vendorId?: string;

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

export class VendorSpendReportQueryDto {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
