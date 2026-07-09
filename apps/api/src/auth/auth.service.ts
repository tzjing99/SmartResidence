import { CacheService } from '@/cache/cache.service';
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
import { isValidMalaysiaPhone, normalizeMalaysiaPhone } from '@smartresidence/shared-types';
import * as argon2 from 'argon2';
import { PASSWORD_HASH_OPTIONS } from './crypto/argon2-options';
import type {
  RequestOtpDto,
  SignInDto,
  SignUpDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import type { UpdateUserPreferencesDto } from './dto/preferences.dto';
import { type DeviceInfo, SessionService } from './session.service';
import { TotpService } from './totp.service';
import {
  type UserPreferences,
  mergeUserPreferences,
  parseUserPreferences,
} from './user-preferences';

const OTP_TTL_SECONDS = 10 * 60;
/** Short TTL — roles change rarely but must refresh soon after revoke. */
const AUTH_USER_TTL = 90;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly totp: TotpService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly cache: CacheService,
  ) {}

  async signUp(dto: SignUpDto, info: DeviceInfo) {
    const phone = normalizeMalaysiaPhone(dto.phone);
    if (!isValidMalaysiaPhone(phone)) {
      throw new BadRequestException(
        'Enter a valid Malaysia mobile number (e.g. +60123456789 or 012-345 6789)',
      );
    }
    const passwordHash = await argon2.hash(dto.password, PASSWORD_HASH_OPTIONS);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone,
          name: dto.name,
          passwordHash,
          locale: this.config.get('DEFAULT_CONDO_LOCALE', { infer: true }),
        },
      });
      return this.sessions.create(user.id, info);
    } catch (err) {
      AuthService.handlePrismaError(err);
    }
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
    return this.cache.wrapNamespaced(
      `auth:user:${userId}`,
      condoIdHint ?? 'none',
      AUTH_USER_TTL,
      () => this.loadUserFromDb(userId, condoIdHint),
    );
  }

  private async loadUserFromDb(
    userId: string,
    condoIdHint?: string | null,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleAssignments: {
          where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.status === UserStatus.DEACTIVATED || user.deletedAt) {
      throw new UnauthorizedException('Account has been deleted');
    }

    const roles = user.roleAssignments.map((r) => ({
      roleId: r.roleId,
      condoId: r.condoId,
      unitId: r.unitId,
      permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    }));

    const isSuperAdmin = roles.some((r) => r.roleId === RoleId.SUPER_ADMIN);
    const condoIds = Array.from(new Set(roles.map((r) => r.condoId).filter(Boolean) as string[]));
    let activeCondoId: string | null = null;
    if (condoIdHint && (condoIds.includes(condoIdHint) || isSuperAdmin)) {
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
    // Gated on NODE_ENV (not just LOG_LEVEL) so a misconfigured log level can
    // never leak a live OTP code into production logs.
    if (this.config.get('NODE_ENV', { infer: true }) !== 'production') {
      this.logger.debug(`OTP for ${dto.identifier} (${dto.purpose}): ${code}`);
    }
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
    await this.cache.invalidateNamespace(`auth:user:${assignment.userId}`);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        phoneVerifiedAt: true,
        name: true,
        locale: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) {
      const phone = normalizeMalaysiaPhone(dto.phone);
      if (!isValidMalaysiaPhone(phone)) {
        throw new BadRequestException(
          'Enter a valid Malaysia mobile number (e.g. +60123456789 or 012-345 6789)',
        );
      }
      data.phone = phone;
    }
    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }
    try {
      await this.prisma.user.update({ where: { id: userId }, data });
    } catch (err) {
      AuthService.handlePrismaError(err);
    }
    return this.getProfile(userId);
  }

  async getPreferences(userId: string): Promise<UserPreferences & { whatsappEligible: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true, phone: true, phoneVerifiedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...parseUserPreferences(user.preferences),
      whatsappEligible: Boolean(user.phone && user.phoneVerifiedAt),
    };
  }

  async updatePreferences(
    userId: string,
    dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferences & { whatsappEligible: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true, phone: true, phoneVerifiedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (dto.whatsappNotifications === true && (!user.phone || !user.phoneVerifiedAt)) {
      throw new BadRequestException(
        'Add and verify your mobile phone in Profile before enabling WhatsApp notifications.',
      );
    }

    const merged = mergeUserPreferences(user.preferences, {
      ...(dto.emailNotifications !== undefined
        ? { emailNotifications: dto.emailNotifications }
        : {}),
      ...(dto.whatsappNotifications !== undefined
        ? { whatsappNotifications: dto.whatsappNotifications }
        : {}),
      ...(dto.quietHours
        ? {
            quietHours: {
              ...(dto.quietHours.enabled !== undefined ? { enabled: dto.quietHours.enabled } : {}),
              ...(dto.quietHours.start !== undefined ? { start: dto.quietHours.start } : {}),
              ...(dto.quietHours.end !== undefined ? { end: dto.quietHours.end } : {}),
            },
          }
        : {}),
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { preferences: merged as unknown as Prisma.InputJsonValue },
    });
    return {
      ...merged,
      whatsappEligible: Boolean(user.phone && user.phoneVerifiedAt),
    };
  }

  static handlePrismaError(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target : [];
      if (target.includes('phone')) {
        throw new BadRequestException('Phone number already in use');
      }
      throw new BadRequestException('Email already in use');
    }
    throw err as Error;
  }
}
