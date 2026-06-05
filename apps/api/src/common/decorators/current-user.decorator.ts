import type { AuthenticatedUser, RequestWithContext } from '@/common/types/request-context';
import { type ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithContext>();
    const user = request.ctx?.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    return user;
  },
);

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    return ctx.switchToHttp().getRequest<RequestWithContext>().ctx?.user ?? null;
  },
);
