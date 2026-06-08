import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListUnitsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by unit identifier, block, or resident name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
