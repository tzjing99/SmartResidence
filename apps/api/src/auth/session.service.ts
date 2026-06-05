import type { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { TokenService } from './token.service';

export interface DeviceInfo {
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** Create a fresh session for a user and return access + refresh tokens. */
  async create(userId: string, info: DeviceInfo) {
    const refresh = await this.tokens.issueRefreshToken();
    const accessJti = crypto.randomUUID();
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: accessJti,
        refreshTokenHash: refresh.hash,
        ipAddress: info.ipAddress ?? null,
        userAgent: info.userAgent ?? null,
        deviceInfo: info.device ? { device: info.device } : {},
        expiresAt: new Date(Date.now() + this.tokens.refreshTtl * 1000),
        lastUsedAt: new Date(),
      },
    });
    const accessToken = await this.tokens.issueAccessToken({
      userId,
      sessionId: session.id,
    });
    return {
      sessionId: session.id,
      accessToken,
      refreshToken: refresh.token,
      expiresIn: this.tokens.accessTtl,
    };
  }

  async findActive(sessionId: string) {
    return this.prisma.session.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async revoke(sessionId: string, reason = 'user-action') {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason = 'security') {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  /** Refresh-token rotation: verify and replace. */
  async rotate(refreshToken: string) {
    const candidates = await this.prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      take: 100,
      orderBy: { lastUsedAt: 'desc' },
    });
    for (const candidate of candidates) {
      if (!candidate.refreshTokenHash) continue;
      const ok = await this.tokens.verifyRefreshToken(refreshToken, candidate.refreshTokenHash);
      if (ok) {
        const refresh = await this.tokens.issueRefreshToken();
        await this.prisma.session.update({
          where: { id: candidate.id },
          data: {
            refreshTokenHash: refresh.hash,
            lastUsedAt: new Date(),
          },
        });
        const accessToken = await this.tokens.issueAccessToken({
          userId: candidate.userId,
          sessionId: candidate.id,
        });
        return {
          sessionId: candidate.id,
          accessToken,
          refreshToken: refresh.token,
          expiresIn: this.tokens.accessTtl,
        };
      }
    }
    return null;
  }
}
