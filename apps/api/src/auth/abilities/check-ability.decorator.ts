import { SetMetadata } from '@nestjs/common';
import type { Action, Subject } from './ability.factory';

export const CHECK_ABILITY_KEY = 'sr:check-ability';

export interface RequiredAbility {
  action: Action;
  subject: Subject;
}

/**
 * Declares the ability required to invoke the handler. Multiple decorators
 * can be stacked — all must pass.
 */
export const CheckAbility = (...rules: RequiredAbility[]) => SetMetadata(CHECK_ABILITY_KEY, rules);
