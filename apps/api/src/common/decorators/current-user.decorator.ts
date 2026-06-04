import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { RequestWithContext, AuthenticatedUser } from '@/common/types/request-context';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  const user = request.ctx?.user;
  if (!user) {
    throw new UnauthorizedException('Authentication required');
  }
  return user;
});

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    return ctx.switchToHttp().getRequest<RequestWithContext>().ctx?.user ?? null;
  },
);
