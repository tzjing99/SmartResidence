import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepositStatus, DepositType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ListDepositsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DepositStatus })
  @IsOptional()
  @IsEnum(DepositStatus)
  status?: DepositStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class RecordDepositDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiPropertyOptional({ description: 'Owner/payer the deposit is attributed to.' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ enum: DepositType })
  @IsEnum(DepositType)
  type!: DepositType;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ description: 'e.g. CASH, BANK_TRANSFER, CHEQUE' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: 'Bank/cheque/receipt reference.' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RefundDepositDto {
  @ApiPropertyOptional({
    minimum: 0,
    description: 'Amount to refund/forfeit. Defaults to the full held balance.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'When true the amount is forfeited (kept) rather than refunded to the owner.',
  })
  @IsOptional()
  @IsBoolean()
  forfeit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
