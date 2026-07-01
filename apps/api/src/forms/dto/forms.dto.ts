import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FormSubmissionStatus, FormTemplateKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class FormFieldDefinitionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;

  @ApiProperty({ enum: ['text', 'textarea', 'date', 'boolean', 'select'] })
  @IsString()
  type!: 'text' | 'textarea' | 'date' | 'boolean' | 'select';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  placeholder?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class FormFieldsDto {
  @ApiProperty({ type: [FormFieldDefinitionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDefinitionDto)
  fields!: FormFieldDefinitionDto[];
}

export class CreateFormTemplateDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty({ enum: FormTemplateKind })
  @IsEnum(FormTemplateKind)
  kind!: FormTemplateKind;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ type: FormFieldsDto })
  @ValidateNested()
  @Type(() => FormFieldsDto)
  fields!: FormFieldsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number;
}

export class UpdateFormTemplateDto {
  @ApiPropertyOptional({ enum: FormTemplateKind })
  @IsOptional()
  @IsEnum(FormTemplateKind)
  kind?: FormTemplateKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ type: FormFieldsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FormFieldsDto)
  fields?: FormFieldsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number;
}

export class CreateFormSubmissionDto {
  @ApiProperty()
  @IsUUID()
  templateId!: string;

  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'When true, submit immediately instead of saving a draft' })
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class UpdateFormSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class RejectFormSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;
}

export class ListFormSubmissionsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: FormSubmissionStatus })
  @IsOptional()
  @IsEnum(FormSubmissionStatus)
  status?: FormSubmissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class ListFormTemplatesDto {
  @ApiPropertyOptional({ description: 'Include inactive templates (management only)' })
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}
