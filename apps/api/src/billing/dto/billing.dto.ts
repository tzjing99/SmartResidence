import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class InvoiceLineDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formula?: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ minimum: 0, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  periodStart!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  periodEnd!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  dueDate!: Date;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}

export class CreatePaymentDto {
  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  returnUrl?: string;
}

export class RecordManualPaymentDto {
  @ApiPropertyOptional({
    minimum: 0,
    description: 'Amount settled. Defaults to the full outstanding balance.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'e.g. CASH, BANK_TRANSFER, CHEQUE' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: 'Bank/cheque/receipt reference for reconciliation.' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class GenerateRecurringDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  periodStart!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  periodEnd!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  dueDate!: Date;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Restrict to specific units. Defaults to every unit in the condo.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  unitIds?: string[];
}
