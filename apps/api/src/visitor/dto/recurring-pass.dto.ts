import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecurringPassTimeWindowDto {
  @ApiProperty({ example: '08:00' })
  @IsString()
  start!: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  end!: string;
}

export class RecurringPassScheduleDto {
  @ApiProperty({ type: [Number], example: [1, 2, 3, 4, 5] })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek!: number[];

  @ApiProperty({ type: RecurringPassTimeWindowDto })
  @ValidateNested()
  @Type(() => RecurringPassTimeWindowDto)
  timeWindow!: RecurringPassTimeWindowDto;
}

export class CreateRecurringPassDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  guestName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehiclePlate?: string;

  @ApiProperty({ type: RecurringPassScheduleDto })
  @ValidateNested()
  @Type(() => RecurringPassScheduleDto)
  schedule!: RecurringPassScheduleDto;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  validFrom!: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  validUntil!: Date;
}

export class UpdateRecurringPassDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehiclePlate?: string;

  @ApiPropertyOptional({ type: RecurringPassScheduleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurringPassScheduleDto)
  schedule?: RecurringPassScheduleDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validUntil?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
