import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateFacilityDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bookingFee?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ description: '24h HH:mm', example: '08:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'openTime must be HH:mm (24h)' })
  openTime?: string;

  @ApiPropertyOptional({ description: '24h HH:mm', example: '22:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'closeTime must be HH:mm (24h)' })
  closeTime?: string;

  @ApiPropertyOptional({ minimum: 15, maximum: 1440 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  slotMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  position?: number;
}

export class UpdateFacilityDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bookingFee?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ description: '24h HH:mm' })
  @IsOptional()
  @Matches(HHMM, { message: 'openTime must be HH:mm (24h)' })
  openTime?: string;

  @ApiPropertyOptional({ description: '24h HH:mm' })
  @IsOptional()
  @Matches(HHMM, { message: 'closeTime must be HH:mm (24h)' })
  closeTime?: string;

  @ApiPropertyOptional({ minimum: 15, maximum: 1440 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  slotMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  position?: number;
}

export class ListFacilitiesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Include inactive facilities (management only)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}

export class AvailabilityQueryDto {
  @ApiProperty({ description: 'Day to inspect, ISO date (YYYY-MM-DD).' })
  @IsString()
  date!: string;
}

export class ListBookingsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Only future bookings when true.' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  upcoming?: boolean;
}
