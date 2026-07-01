import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { McpTransport } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertMcpServerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ enum: McpTransport })
  @IsEnum(McpTransport)
  transport!: McpTransport;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  serverUrl?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  publicConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Write-only bearer token or API key' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  authToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class SetMcpServerEnabledDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
