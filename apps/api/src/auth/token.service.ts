import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import * as argon2 from 'argon2';
import type { AppEnv } from '@/config/env.schema';
import { RedisService } from '@/redis/redis.service';

const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AccessTokenClaims {
  sub: string;
  jti: string;
  sid: string;
  iat: number;
  exp: number;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly key: Uint8Array;

  constructor(
    config: ConfigService<AppEnv, true>,
    private readonly redis: RedisService,
  ) {
    this.key = new TextEncoder().encode(config.get('BETTER_AUTH_SECRET', { infer: true }));
  }

  async issueAccessToken(opts: { userId: string; sessionId: string }): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(opts.userId)
      .setJti(nanoid(16))
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .setIssuer('smartresidence')
      .setAudience('smartresidence-clients')
      .setNotBefore(0)
      .sign(this.key);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.key, {
      issuer: 'smartresidence',
      audience: 'smartresidence-clients',
    });
    if (await this.redis.isTokenBlocked(payload.jti as string)) {
      throw new Error('Token revoked');
    }
    return payload as unknown as AccessTokenClaims;
  }

  /**
   * Refresh tokens are opaque — we hash them with argon2 and store the hash
   * on the Session record. Rotation: every refresh issues a new token and
   * revokes the previous hash.
   */
  async issueRefreshToken(): Promise<{ token: string; hash: string }> {
    const token = nanoid(48);
    const hash = await argon2.hash(token);
    return { token, hash };
  }

  async verifyRefreshToken(token: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, token);
    } catch (err) {
      this.logger.debug('Refresh token verify failed', err);
      return false;
    }
  }

  async revokeAccessJti(jti: string, ttlSeconds = ACCESS_TTL_SECONDS): Promise<void> {
    await this.redis.blocklistToken(jti, ttlSeconds);
  }

  get accessTtl() {
    return ACCESS_TTL_SECONDS;
  }
  get refreshTtl() {
    return REFRESH_TTL_SECONDS;
  }
}
