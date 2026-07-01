import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateWhatsAppConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Meta WhatsApp phone number ID.' })
  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @ApiPropertyOptional({ description: 'Meta WhatsApp Business account ID.' })
  @IsOptional()
  @IsString()
  businessAccountId?: string;

  @ApiPropertyOptional({
    description: 'Meta Cloud API access token (write-only; stored encrypted).',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class WhatsAppTestSendDto {
  @ApiProperty({
    description: 'E.164 phone number to send the test template to, e.g. +60123456789.',
  })
  @IsString()
  phone!: string;
}
