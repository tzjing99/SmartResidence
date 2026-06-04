import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { TotpService } from './totp.service';
import { AbilityFactory } from './abilities/ability.factory';
import { AuthGuard } from './guards/auth.guard';
import { AbilitiesGuard } from './guards/abilities.guard';

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
