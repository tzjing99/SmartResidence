import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitorEntryMode, VisitorPurpose, VisitorStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { VisitorAdminFilter, VisitorListView } from '../visitor.constants';

export class ListVisitorsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['upcoming', 'live', 'history'] })
  @IsOptional()
  @IsIn(['upcoming', 'live', 'history'])
  view?: VisitorListView;

  @ApiPropertyOptional({ enum: VisitorStatus })
  @IsOptional()
  @IsEnum(VisitorStatus)
  status?: VisitorStatus;

  @ApiPropertyOptional({ enum: ['overnight_pending', 'urgent_overnight', 'holiday_review'] })
  @IsOptional()
  @IsIn(['overnight_pending', 'urgent_overnight', 'holiday_review'])
  filter?: VisitorAdminFilter;
}

export class CreateVisitorDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  identification?: string;

  @ApiPropertyOptional({ default: '+60' })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  phoneCountryCode?: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  phone!: string;

  @ApiPropertyOptional({ enum: VisitorEntryMode, default: VisitorEntryMode.DRIVE_IN })
  @IsOptional()
  @IsEnum(VisitorEntryMode)
  entryMode?: VisitorEntryMode;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateVisitorDto) => o.entryMode === VisitorEntryMode.DRIVE_IN)
  @IsString()
  @MaxLength(20)
  vehiclePlate?: string;

  @ApiPropertyOptional({ enum: VisitorPurpose, default: VisitorPurpose.VISITOR })
  @IsOptional()
  @IsEnum(VisitorPurpose)
  purpose?: VisitorPurpose;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  expectedAt!: Date;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedDurationMins?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  overnight?: boolean;

  @ApiPropertyOptional({ description: 'Required when urgent overnight (<24h notice)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  urgentReason?: string;

  @ApiPropertyOptional({
    description: 'S3 object key from attachments presign — required for overnight',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  vehiclePlatePhotoUrl?: string;
}

export class WorkingDaysDto {
  @ApiProperty({ type: [Number], example: [1, 2, 3, 4, 5] })
  weekdays!: number[];
}

export class UpdateVisitorSettingsDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOvernightVisitsPerUnitPerMonth?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  overnightSlotsPerNight?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  walkInApprovalMinutes?: number;

  @ApiPropertyOptional({
    description:
      'When true, unit walk-ins require owner/tenant approval. When false, guard checks in immediately.',
  })
  @IsOptional()
  @IsBoolean()
  walkInRequireOwnerApproval?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  preRegExpiryBufferMins?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  urgentOvernightMinHours?: number;

  @ApiPropertyOptional({ type: WorkingDaysDto })
  @IsOptional()
  @Type(() => WorkingDaysDto)
  workingDays?: WorkingDaysDto;

  @ApiPropertyOptional({
    description: 'Auto-populate Malaysia public holidays from a maintained source',
  })
  @IsOptional()
  @IsBoolean()
  holidayAuto?: boolean;

  @ApiPropertyOptional({ description: "date-holidays state code ('' = federal/nationwide only)" })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  holidayState?: string;

  @ApiPropertyOptional({ type: [String], description: 'Manually added holiday dates (YYYY-MM-DD)' })
  @IsOptional()
  @IsString({ each: true })
  customHolidays?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Auto holiday dates to exclude (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString({ each: true })
  holidayExclusions?: string[];

  @ApiPropertyOptional({
    type: [String],
    deprecated: true,
    description: 'Legacy flat holiday list — superseded by customHolidays/holidayExclusions',
  })
  @IsOptional()
  @IsString({ each: true })
  publicHolidays?: string[];

  @ApiPropertyOptional({
    description:
      'When true, overnight on holidays/non-working days is auto-approved if slots are available',
  })
  @IsOptional()
  @IsBoolean()
  holidayOvernightAutoApprove?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  countPendingTowardCap?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requirePlatePhotoOvernight?: boolean;

  @ApiPropertyOptional({ enum: VisitorPurpose })
  @IsOptional()
  @IsEnum(VisitorPurpose)
  defaultPurpose?: VisitorPurpose;
}

export class SuspendOvernightDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  until?: Date;

  @ApiPropertyOptional({ description: 'Suspend until manually lifted (ignores until when true)' })
  @IsOptional()
  @IsBoolean()
  indefinite?: boolean;
}

export class FlagPlateMismatchDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Also suspend overnight registration for the unit owner' })
  @IsOptional()
  @IsBoolean()
  suspendOwner?: boolean;
}

export class CreateWalkInUnitDto {
  @ApiPropertyOptional({
    description: 'Not supported — walk-ins are validated once at the gate (single visit)',
  })
  @IsOptional()
  @IsBoolean()
  overnight?: boolean;

  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehiclePlate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  purpose?: string;
}

export class CreateWalkInOfficeDto {
  @ApiPropertyOptional({
    description: 'Not supported — walk-ins are validated once at the gate (single visit)',
  })
  @IsOptional()
  @IsBoolean()
  overnight?: boolean;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehiclePlate?: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  purpose!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gateLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectVisitorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class CheckInVisitorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gateLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateFavouriteVisitorDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ default: '+60' })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  phoneCountryCode?: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  phone!: string;

  @ApiPropertyOptional({ enum: VisitorEntryMode, default: VisitorEntryMode.DRIVE_IN })
  @IsOptional()
  @IsEnum(VisitorEntryMode)
  entryMode?: VisitorEntryMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehiclePlate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

export class UpdateFavouriteVisitorDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(6)
  phoneCountryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: VisitorEntryMode })
  @IsOptional()
  @IsEnum(VisitorEntryMode)
  entryMode?: VisitorEntryMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehiclePlate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}
