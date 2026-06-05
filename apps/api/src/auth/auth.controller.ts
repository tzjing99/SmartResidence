import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser, RequestWithContext } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import type { Request } from 'express';
import { AbilityFactory } from './abilities/ability.factory';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import {
  EnableTotpDto,
  RefreshDto,
  RequestOtpDto,
  SignInDto,
  SignUpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { AuthGuard } from './guards/auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly abilities: AbilityFactory,
  ) {}

  @Public()
  @Post('sign-up')
  @ApiOperation({ summary: 'Create a new user account' })
  signUp(@Body() dto: SignUpDto, @Req() req: Request) {
    return this.auth.signUp(dto, this.deviceInfo(req));
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email + password (+ optional TOTP)' })
  signIn(@Body() dto: SignInDto, @Req() req: Request) {
    return this.auth.signIn(dto, this.deviceInfo(req));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('access')
  @Audit({ action: AuditAction.LOGOUT, resourceType: 'Session' })
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Req() req: RequestWithContext) {
    const sid = (req.headers['x-session-id'] as string | undefined) ?? '';
    if (sid) await this.auth.signOut(sid);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyOtp(dto, this.deviceInfo(req));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('access')
  @Get('me')
  @ApiOperation({ summary: 'Returns the current user, roles, and ability rules' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      user,
      abilities: this.abilities.rulesFor(user),
    };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('access')
  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user.id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('access')
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.auth.revokeSession(user.id, id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('access')
  @Post('totp/enroll/start')
  startTotp(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.startTotpEnrollment(user);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('access')
  @Post('totp/enroll/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmTotp(@CurrentUser() user: AuthenticatedUser, @Body() dto: EnableTotpDto) {
    // Real flow: client sends back the secret it received from /start.
    // For brevity we expect it in the body via `code`'s sibling field.
    // (This is a simplified scaffold; production flow stores the pending
    // secret in Redis keyed by user id during enrollment.)
    const secret = dto.code; // placeholder: extend DTO with `secret` in v0.2
    return this.auth.confirmTotp(user.id, secret, dto.code);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('access')
  @Audit({ action: AuditAction.REVOKE_ACCESS, resourceType: 'RoleAssignment' })
  @Delete('role-assignments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Revoke a delegated role grant. Owner-empowerment: kills all sessions of the affected user immediately.',
  })
  revokeDelegatedRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.auth.revokeDelegatedRole({ actor, roleAssignmentId: id });
  }

  private deviceInfo(req: Request) {
    return {
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      device: (req.headers['x-device-name'] as string | undefined) ?? null,
    };
  }
}
