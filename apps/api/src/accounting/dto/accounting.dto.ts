import { GlAccountType, LedgerFund } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateGlAccountDto {
  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(GlAccountType)
  type!: GlAccountType;

  @IsEnum(LedgerFund)
  fund!: LedgerFund;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateGlAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class JournalLineDto {
  @IsUUID()
  accountId!: string;

  @IsNumber()
  @Min(0)
  debit!: number;

  @IsNumber()
  @Min(0)
  credit!: number;

  @IsEnum(LedgerFund)
  fund!: LedgerFund;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}

export class PostManualJournalDto {
  @IsString()
  entryDate!: string;

  @IsString()
  @MaxLength(300)
  description!: string;

  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class ListJournalsQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

export class ImportBankStatementDto {
  @IsUUID()
  accountId!: string;

  @IsString()
  periodStart!: string;

  @IsString()
  periodEnd!: string;

  @IsNumber()
  openingBalance!: number;

  @IsNumber()
  closingBalance!: number;

  @IsString()
  csv!: string;
}

export class MatchBankLineDto {
  @IsOptional()
  @IsUUID()
  journalLineId?: string | null;
}
