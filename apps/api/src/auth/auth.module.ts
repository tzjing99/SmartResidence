import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AbilityFactory } from './abilities/ability.factory';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AbilitiesGuard } from './guards/abilities.guard';
import { AuthGuard } from './guards/auth.guard';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

@Module({
  providers: [
    AuthService,
    TokenService,
    SessionService,
    TotpService,
    AbilityFactory,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AbilitiesGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService, AbilityFactory, TokenService, SessionService],
})
export class AuthModule {}
