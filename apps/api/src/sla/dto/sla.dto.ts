import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThreadCategory, ThreadPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SlaPolicyItemDto {
  @ApiProperty({ enum: ThreadPriority })
  @IsEnum(ThreadPriority)
  priority!: ThreadPriority;

  @ApiProperty({ description: 'Resolution window in minutes (first-response derived at 40%).' })
  @IsInt()
  @Min(15)
  @Max(60 * 24 * 30)
  resolutionMins!: number;
}

export class UpdateSlaPoliciesDto {
  @ApiProperty({ type: [SlaPolicyItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SlaPolicyItemDto)
  policies!: SlaPolicyItemDto[];

  @ApiPropertyOptional({ description: 'Grace period for resident resolution confirmation (days).' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  resolutionConfirmationGraceDays?: number;

  @ApiPropertyOptional({
    description: 'Required when saving any priority in the risky band.',
  })
  @IsOptional()
  @IsBoolean()
  riskyAcknowledged?: boolean;

  @ApiPropertyOptional({
    description: 'Optional rationale published with transparency announcement.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rationale?: string;
}

export class SlaAuditQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  condoId?: string;
}

export class CategoryPoolDto {
  @ApiProperty({ enum: ThreadCategory })
  @IsEnum(ThreadCategory)
  category!: ThreadCategory;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds!: string[];
}

export class UpdateAutoAssignmentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  generalTriagePool!: string[];

  @ApiProperty({ type: [CategoryPoolDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryPoolDto)
  categoryPools!: CategoryPoolDto[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  seniorStaffPool!: string[];
}
