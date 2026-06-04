import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../token.service';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { RequestWithContext } from '@/common/types/request-context';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing access token');

    let claims;
    try {
      claims = await this.tokens.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const condoHint = (req.headers['x-condo-id'] as string | undefined) ?? null;
    const user = await this.auth.loadUser(claims.sub, condoHint);

    req.ctx ??= {
      requestId: '',
      user: null,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    };
    req.ctx.user = user;
    return true;
  }

  private extractToken(req: RequestWithContext): string | null {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const cookie = (req.cookies as Record<string, string> | undefined)?.['sr.session'];
    return cookie ?? null;
  }
}
