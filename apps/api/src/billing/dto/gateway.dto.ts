import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GatewayMode, PaymentProvider } from '@prisma/client';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertGatewayDto {
  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @ApiProperty({ enum: GatewayMode })
  @IsEnum(GatewayMode)
  mode!: GatewayMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  publicConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Plaintext credentials (write-only). Encrypted at rest; never returned.',
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}

export class SetGatewayEnabledDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
