import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum EInvoiceEnvironmentDto {
  SANDBOX = 'SANDBOX',
  PRODUCTION = 'PRODUCTION',
}

export class UpdateEInvoiceConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: EInvoiceEnvironmentDto })
  @IsOptional()
  @IsEnum(EInvoiceEnvironmentDto)
  environment?: EInvoiceEnvironmentDto;

  @ApiPropertyOptional({ description: 'Auto-submit to LHDN when an invoice is issued.' })
  @IsOptional()
  @IsBoolean()
  autoSubmitOnIssue?: boolean;

  @ApiPropertyOptional({ description: 'Supplier TIN, e.g. C1234567890.' })
  @IsOptional()
  @IsString()
  supplierTin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({ description: 'Business registration number (SSM/BRN).' })
  @IsOptional()
  @IsString()
  registrationNo?: string;

  @ApiPropertyOptional({ description: 'SST registration number (or NA).' })
  @IsOptional()
  @IsString()
  sstRegistrationNo?: string;

  @ApiPropertyOptional({ description: '5-digit MSIC 2008 business code.' })
  @IsOptional()
  @IsString()
  msicCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessActivityDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postcode?: string;

  @ApiPropertyOptional({ description: 'LHDN state code, e.g. 10 (Selangor).' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierPhone?: string;

  @ApiPropertyOptional({ description: 'LHDN tax type code (e.g. 06 = Not Applicable).' })
  @IsOptional()
  @IsString()
  defaultTaxType?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultTaxRate?: number;

  @ApiPropertyOptional({ description: 'LHDN API client id (write-only; stored encrypted).' })
  @IsOptional()
  @IsString()
  apiClientId?: string;

  @ApiPropertyOptional({ description: 'LHDN API client secret (write-only; stored encrypted).' })
  @IsOptional()
  @IsString()
  apiClientSecret?: string;
}

export class CancelEInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
