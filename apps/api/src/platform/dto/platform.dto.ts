import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListPlatformCondosQueryDto {
  @ApiPropertyOptional({ description: 'Filter by name, slug, or address' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
