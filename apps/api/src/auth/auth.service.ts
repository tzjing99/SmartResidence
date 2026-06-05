import type { AuthenticatedUser } from '@/common/types/request-context';
import type { AppEnv } from '@/config/env.schema';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RoleId, UserStatus, VerificationPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import type { RequestOtpDto, SignInDto, SignUpDto, VerifyOtpDto } from './dto/auth.dto';
import { SessionService, type DeviceInfo } from './session.service';
import { TotpService } from './totp.service';

const OTP_TTL_SECONDS = 10 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly totp: TotpService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async signUp(dto: SignUpDto, info: DeviceInfo) {
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        locale: this.config.get('DEFAULT_CONDO_LOCALE', { infer: true }),
      },
    });
    return this.sessions.create(user.id, info);
  }

  async signIn(dto: SignInDto, info: DeviceInfo) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not active');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (user.totpSecret) {
      if (!dto.totp) throw new UnauthorizedException('2FA code required');
      if (!this.totp.verify(dto.totp, user.totpSecret)) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
    return this.sessions.create(user.id, info);
  }

  async signOut(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, 'user-signout');
  }

  async refresh(refreshToken: string) {
    const result = await this.sessions.rotate(refreshToken);
    if (!result) throw new UnauthorizedException('Invalid refresh token');
    return result;
  }

  /** Resolve the AuthenticatedUser used in `req.ctx.user`. */
  async loadUser(userId: string, condoIdHint?: string | null): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleAssignments: {
          where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User no longer exists');

    const roles = user.roleAssignments.map((r) => ({
      roleId: r.roleId,
      condoId: r.condoId,
      unitId: r.unitId,
      permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    }));

    const condoIds = Array.from(new Set(roles.map((r) => r.condoId).filter(Boolean) as string[]));
    let activeCondoId: string | null = null;
    if (condoIdHint && condoIds.includes(condoIdHint)) {
      activeCondoId = condoIdHint;
    } else if (condoIds.length === 1) {
      activeCondoId = condoIds[0] ?? null;
    }

    const rolePriority: Record<RoleId, number> = {
      [RoleId.SUPER_ADMIN]: 100,
      [RoleId.MANAGEMENT_ADMIN]: 80,
      [RoleId.MANAGEMENT_STAFF]: 70,
      [RoleId.SECURITY_GUARD]: 60,
      [RoleId.UNIT_OWNER]: 50,
      [RoleId.TENANT]: 40,
      [RoleId.HOUSEHOLD_MEMBER]: 30,
      [RoleId.CONTRACTOR]: 20,
    };
    const activeRole =
      roles
        .filter((r) => r.condoId === activeCondoId || r.condoId === null)
        .sort((a, b) => rolePriority[b.roleId] - rolePriority[a.roleId])[0]?.roleId ?? null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      roles,
      activeCondoId,
      activeRole,
    };
  }

  /** Email/phone OTP request. Always returns success to avoid enumeration. */
  async requestOtp(dto: RequestOtpDto): Promise<{ ok: true }> {
    const code = `${Math.floor(100000 + Math.random() * 900000)}`;
    const codeHash = await argon2.hash(code);
    let userId: string | null = null;
    if (
      dto.purpose === VerificationPurpose.LOGIN_OTP ||
      dto.purpose === VerificationPurpose.PASSWORD_RESET
    ) {
      const user = await this.prisma.user.findFirst({
        where: { OR: [{ email: dto.identifier.toLowerCase() }, { phone: dto.identifier }] },
      });
      userId = user?.id ?? null;
    }

    await this.prisma.verificationCode.create({
      data: {
        userId,
        identifier: dto.identifier.toLowerCase(),
        codeHash,
        purpose: dto.purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    });

    // The notification service handles actual delivery. In development the
    // console output is the delivery channel — see Mailpit at :8025 too.
    this.logger.debug(`OTP for ${dto.identifier} (${dto.purpose}): ${code}`);
    return { ok: true };
  }

  async verifyOtp(dto: VerifyOtpDto, info: DeviceInfo) {
    const record = await this.prisma.verificationCode.findFirst({
      where: {
        identifier: dto.identifier.toLowerCase(),
        purpose: dto.purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Code expired or unknown');
    if (record.attempts >= 5) {
      throw new ForbiddenException('Too many attempts');
    }
    const ok = await argon2.verify(record.codeHash, dto.code);
    if (!ok) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid code');
    }
    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    if (dto.purpose === VerificationPurpose.LOGIN_OTP && record.userId) {
      return this.sessions.create(record.userId, info);
    }
    if (dto.purpose === VerificationPurpose.EMAIL_VERIFY && record.userId) {
      await this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return { ok: true };
  }

  async listSessions(userId: string) {
    return this.sessions.listForUser(userId);
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.sessions.revoke(sessionId, 'user-revoke');
  }

  async startTotpEnrollment(user: AuthenticatedUser) {
    const secret = this.totp.generateSecret();
    return {
      secret,
      otpauthUri: this.totp.uri(user.email ?? user.name, secret),
    };
  }

  async confirmTotp(userId: string, secret: string, code: string) {
    if (!this.totp.verify(code, secret)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });
  }

  /**
   * Owner-empowerment helper: revoke a delegated role grant immediately and
   * kill all active sessions for the affected user so their access is gone
   * by the next request cycle.
   */
  async revokeDelegatedRole(opts: {
    actor: AuthenticatedUser;
    roleAssignmentId: string;
  }): Promise<void> {
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: opts.roleAssignmentId },
    });
    if (!assignment) throw new NotFoundException('Role assignment not found');

    const isOwnerOfUnit =
      assignment.unitId &&
      opts.actor.roles.some(
        (r) => r.roleId === RoleId.UNIT_OWNER && r.unitId === assignment.unitId,
      );
    const isAdmin = opts.actor.roles.some(
      (r) =>
        r.roleId === RoleId.SUPER_ADMIN ||
        (r.roleId === RoleId.MANAGEMENT_ADMIN && r.condoId === assignment.condoId),
    );
    if (!isOwnerOfUnit && !isAdmin) {
      throw new ForbiddenException('You cannot revoke this role');
    }

    await this.prisma.$transaction([
      this.prisma.roleAssignment.update({
        where: { id: opts.roleAssignmentId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: assignment.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'role-revoked' },
      }),
    ]);
  }

  static handlePrismaError(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestException('Email already in use');
    }
    throw err as Error;
  }
}
