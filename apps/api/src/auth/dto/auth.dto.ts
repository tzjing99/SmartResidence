import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationPurpose } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ minLength: 10, maxLength: 200 })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  @Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'password must contain a lowercase letter' })
  @Matches(/\d/, { message: 'password must contain a digit' })
  password!: string;

  @ApiProperty({
    description: 'Malaysia mobile number (e.g. +60123456789 or 012-345 6789)',
    example: '+60123456789',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invitationCode?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Malaysia mobile number (e.g. +60123456789 or 012-345 6789)',
    example: '+60123456789',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone?: string;
}

export class SignInDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;

  @ApiPropertyOptional({ description: '6-digit TOTP code if 2FA is enabled' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  totp?: string;
}

export class RequestOtpDto {
  @ApiProperty({ description: 'Email or E.164 phone number' })
  @IsString()
  identifier!: string;

  @ApiProperty({ enum: VerificationPurpose })
  @IsEnum(VerificationPurpose)
  purpose!: VerificationPurpose;
}

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  identifier!: string;

  @ApiProperty({ enum: VerificationPurpose })
  @IsEnum(VerificationPurpose)
  purpose!: VerificationPurpose;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class EnableTotpDto {
  @ApiProperty({ description: 'The base32 secret returned by /totp/enroll/start' })
  @IsString()
  secret!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}
