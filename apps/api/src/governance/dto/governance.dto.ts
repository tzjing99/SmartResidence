import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GeneralMeetingKind, GeneralMeetingStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateGeneralMeetingDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty({ enum: GeneralMeetingKind })
  @IsEnum(GeneralMeetingKind)
  kind!: GeneralMeetingKind;

  @ApiProperty({ minLength: 4, maxLength: 200 })
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  scheduledAt!: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noticeBody?: string;
}

export class UpdateGeneralMeetingDto {
  @ApiPropertyOptional({ enum: GeneralMeetingKind })
  @IsOptional()
  @IsEnum(GeneralMeetingKind)
  kind?: GeneralMeetingKind;

  @ApiPropertyOptional({ minLength: 4, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noticeBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minutesBody?: string;

  @ApiPropertyOptional({ enum: GeneralMeetingStatus })
  @IsOptional()
  @IsEnum(GeneralMeetingStatus)
  status?: GeneralMeetingStatus;
}

export class CreateMeetingResolutionDto {
  @ApiProperty({ minLength: 4, maxLength: 200 })
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  position?: number;
}

export class UpdateMeetingResolutionDto {
  @ApiPropertyOptional({ minLength: 4, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  position?: number;
}

export class OpenResolutionVotingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  votingOpensAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  votingClosesAt?: Date;
}

export class SubmitMeetingProxyDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  proxyHolderName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  proxyHolderContact?: string;
}

export class CastResolutionVoteDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty()
  @IsUUID()
  optionId!: string;
}

export class ListMeetingsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Management view — includes drafts' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  manage?: boolean;
}

export class ResolutionOptionInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  position?: number;
}

export class CreateMeetingResolutionWithOptionsDto extends CreateMeetingResolutionDto {
  @ApiPropertyOptional({
    description: 'Vote options; defaults to For / Against / Abstain when omitted',
    type: [ResolutionOptionInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolutionOptionInputDto)
  options?: ResolutionOptionInputDto[];
}

export class PublishMeetingMinutesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minutesBody?: string;
}
