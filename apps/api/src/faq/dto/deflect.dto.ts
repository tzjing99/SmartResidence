import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThreadCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class DeflectMatchDto {
  @ApiProperty()
  @IsUUID()
  condoId!: string;

  @ApiProperty({ minLength: 3, maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({ enum: ThreadCategory })
  @IsOptional()
  @IsEnum(ThreadCategory)
  category?: ThreadCategory;
}
