import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentFolderAudience } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ListDocumentFoldersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeInactive?: boolean;
}

export class CreateDocumentFolderDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: DocumentFolderAudience })
  @IsOptional()
  @IsEnum(DocumentFolderAudience)
  audience?: DocumentFolderAudience;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number;
}

export class UpdateDocumentFolderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: DocumentFolderAudience })
  @IsOptional()
  @IsEnum(DocumentFolderAudience)
  audience?: DocumentFolderAudience;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListDocumentsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeInactive?: boolean;
}

export class CreateDocumentDto {
  @ApiProperty()
  @IsUUID()
  folderId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class PublishDocumentVersionDto {
  @ApiProperty({ description: 'PENDING attachment id from POST /api/uploads' })
  @IsUUID()
  attachmentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
