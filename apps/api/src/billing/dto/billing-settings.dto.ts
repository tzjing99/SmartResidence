import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum BillingAutomationPeriodStrategyDto {
  CURRENT_MONTH = 'CURRENT_MONTH',
  NEXT_MONTH = 'NEXT_MONTH',
}

export enum BillingAutomationDueStrategyDto {
  DAY_OF_MONTH = 'DAY_OF_MONTH',
  OFFSET_DAYS = 'OFFSET_DAYS',
}

export class UpdateReceiptTemplateDto {
  @ApiPropertyOptional({ description: 'Receipt number prefix, e.g. RCPT.' })
  @IsOptional()
  @IsString()
  numberPrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNo?: string;

  @ApiPropertyOptional({ description: 'Multi-line address (newline separated).' })
  @IsOptional()
  @IsString()
  addressLines?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  footerNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatoryName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatoryTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpdateBillingAutomationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  generationDay?: number;

  @ApiPropertyOptional({ enum: BillingAutomationPeriodStrategyDto })
  @IsOptional()
  @IsEnum(BillingAutomationPeriodStrategyDto)
  periodStrategy?: BillingAutomationPeriodStrategyDto;

  @ApiPropertyOptional({ enum: BillingAutomationDueStrategyDto })
  @IsOptional()
  @IsEnum(BillingAutomationDueStrategyDto)
  dueStrategy?: BillingAutomationDueStrategyDto;

  @ApiPropertyOptional({ minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  dueOffsetDays?: number;
}

export class RunBillingAutomationDto {
  @ApiPropertyOptional({ description: 'Preview the run without creating invoices.' })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
