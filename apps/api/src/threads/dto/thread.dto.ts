import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThreadCategory, ThreadPriority, ThreadStatus } from '@prisma/client';
import {
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
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class UpdateThreadDto {
  @ApiPropertyOptional({ enum: ThreadPriority })
  @IsOptional()
  @IsEnum(ThreadPriority)
  priority?: ThreadPriority;

  @ApiPropertyOptional({ enum: ThreadStatus })
  @IsOptional()
  @IsEnum(ThreadStatus)
  status?: ThreadStatus;

  @ApiPropertyOptional({ description: 'Assign the thread to a management user.' })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
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
