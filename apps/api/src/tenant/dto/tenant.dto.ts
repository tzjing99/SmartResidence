import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ListUnitsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by unit identifier, block, or resident name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class UpdateResidentContactDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Malaysia mobile number' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone?: string;
}
