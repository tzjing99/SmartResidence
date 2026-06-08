import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThreadCategory, ThreadPriority, ThreadStatus } from '@prisma/client';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@smartresidence/shared-types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateThreadDto {
  @ApiPropertyOptional({
    description: 'Unit the thread relates to (defaults to the requester unit).',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiProperty({ minLength: 3, maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ enum: ThreadCategory })
  @IsEnum(ThreadCategory)
  category!: ThreadCategory;

  @ApiProperty({ description: 'First message body (markdown).' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class PostMessageDto {
  @ApiProperty({ description: 'Message body (markdown).' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ description: 'Management-only internal note (hidden from residents).' })
  @IsOptional()
  @IsBoolean()
  internalNote?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class UpdateThreadDto {
  @ApiPropertyOptional({ enum: ThreadPriority })
  @IsOptional()
  @IsEnum(ThreadPriority)
  priority?: ThreadPriority;

  @ApiPropertyOptional({ enum: ThreadCategory })
  @IsOptional()
  @IsEnum(ThreadCategory)
  category?: ThreadCategory;

  @ApiPropertyOptional({ enum: ThreadStatus })
  @IsOptional()
  @IsEnum(ThreadStatus)
  status?: ThreadStatus;

  @ApiPropertyOptional({ description: 'Assign the thread to a management user.' })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}

export class ProposeResolutionDto {
  @ApiPropertyOptional({
    description: 'Management message to mark as the proposed solution (B1).',
  })
  @IsOptional()
  @IsUUID()
  messageId?: string;

  @ApiPropertyOptional({ description: 'Optional note shown to the resident with the proposal.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ConfirmResolutionDto {
  @ApiProperty({ description: 'true = resident confirms resolved; false = not resolved.' })
  @IsBoolean()
  confirmed!: boolean;

  @ApiPropertyOptional({
    description: 'Required when rejecting: why the solution is not acceptable.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectReason?: string;

  @ApiPropertyOptional({
    description: 'Required when rejecting: what the resident still wants.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectExpectation?: string;
}

export class AppealThreadDto {
  @ApiProperty({ description: 'Required reason for reopen/appeal (B10).' })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  reason!: string;
}

export class RequestResidentDto {
  @ApiPropertyOptional({
    description: 'Optional message to the resident describing what is needed.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body?: string;
}

export class ListThreadsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ThreadStatus })
  @IsOptional()
  @IsEnum(ThreadStatus)
  status?: ThreadStatus;

  @ApiPropertyOptional({ enum: ThreadPriority })
  @IsOptional()
  @IsEnum(ThreadPriority)
  priority?: ThreadPriority;

  @ApiPropertyOptional({ enum: ThreadCategory })
  @IsOptional()
  @IsEnum(ThreadCategory)
  category?: ThreadCategory;

  @ApiPropertyOptional({ description: 'Filter by assignee (management view).' })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional({ enum: ['ON_TRACK', 'AT_RISK', 'BREACHED'] })
  @IsOptional()
  @IsIn(['ON_TRACK', 'AT_RISK', 'BREACHED'])
  slaState?: 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
}

export class CloseAbusiveThreadDto {
  @ApiProperty({ description: 'Reason shown to the resident (D7).' })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  reason!: string;
}
