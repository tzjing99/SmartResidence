import type { RequestWithContext } from '@/common/types/request-context';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AbilityFactory } from '../abilities/ability.factory';
import { CHECK_ABILITY_KEY, type RequiredAbility } from '../abilities/check-ability.decorator';

@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredAbility[]>(CHECK_ABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const user = req.ctx?.user;
    if (!user) throw new ForbiddenException('Authentication required');

    const ability = this.abilityFactory.build(user);
    for (const rule of required) {
      if (!ability.can(rule.action, rule.subject)) {
        throw new ForbiddenException(`Missing ${rule.action} on ${rule.subject}`);
      }
    }
    return true;
  }
}
