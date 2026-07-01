import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PollAudienceScope, PollStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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

export class PollOptionInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

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

export class CreatePollDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty({ minLength: 4, maxLength: 200 })
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Markdown description of the proposal' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  opensAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  closesAt?: Date;

  @ApiPropertyOptional({ enum: PollAudienceScope })
  @IsOptional()
  @IsEnum(PollAudienceScope)
  audienceScope?: PollAudienceScope;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  blockIds?: string[];

  @ApiPropertyOptional({ type: [PollOptionInputDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PollOptionInputDto)
  options!: PollOptionInputDto[];
}

export class UpdatePollDto {
  @ApiPropertyOptional({ minLength: 4, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  opensAt?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  closesAt?: Date | null;

  @ApiPropertyOptional({ enum: PollAudienceScope })
  @IsOptional()
  @IsEnum(PollAudienceScope)
  audienceScope?: PollAudienceScope;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  blockIds?: string[];

  @ApiPropertyOptional({ enum: PollStatus })
  @IsOptional()
  @IsEnum(PollStatus)
  status?: PollStatus;

  @ApiPropertyOptional({ type: [PollOptionInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PollOptionInputDto)
  options?: PollOptionInputDto[];
}

export class CastPollVoteDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty()
  @IsUUID()
  optionId!: string;
}

export class ListPollsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Management view — includes drafts' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  manage?: boolean;
}
