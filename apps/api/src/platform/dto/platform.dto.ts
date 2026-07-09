import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ListPlatformCondosQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by name, slug, or address' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreatePlatformCondoDto {
  @ApiProperty({ example: 'Acacia Residences' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'acacia-residences' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @ApiProperty({ example: '12 Jalan Demo, Kuala Lumpur' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address!: string;

  @ApiProperty({ example: 'Asia/Kuala_Lumpur' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  timezone!: string;
}

export class UpdatePlatformFeatureFlagsDto {
  @ApiPropertyOptional({ description: 'Helpdesk ML assignee suggestions (C6)' })
  @IsOptional()
  @IsBoolean()
  helpdeskMlAssignee?: boolean;

  @ApiPropertyOptional({ description: 'Helpdesk ML priority suggestions (C6)' })
  @IsOptional()
  @IsBoolean()
  helpdeskMlPriority?: boolean;

  @ApiPropertyOptional({ description: 'WhatsApp outbound notifications' })
  @IsOptional()
  @IsBoolean()
  whatsappNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Resident AI assist seam' })
  @IsOptional()
  @IsBoolean()
  residentAiAssist?: boolean;
}
