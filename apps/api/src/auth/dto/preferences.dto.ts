import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

export class QuietHoursDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: '22:00', description: 'Local start time HH:mm (24h)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  start?: string;

  @ApiPropertyOptional({ example: '07:00', description: 'Local end time HH:mm (24h)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  end?: string;
}

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({ description: 'Opt in to email for thread notifications (E1).' })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    description:
      'Opt in to WhatsApp on the verified account phone (parcel, visitor, billing alerts).',
  })
  @IsOptional()
  @IsBoolean()
  whatsappNotifications?: boolean;

  @ApiPropertyOptional({ type: QuietHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;
}
