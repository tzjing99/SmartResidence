import { Injectable } from '@nestjs/common';
import { MlAssignmentService } from '../ml/ml-assignment.service';
import type {
  AssignmentAssistInput,
  AssignmentAssistProvider,
  AssignmentSuggestion,
} from './assignment-assist.provider';
import { RuleBasedAssignmentAssistProvider } from './assignment-assist.provider';

/**
 * Tries ML assignee suggestion first when active; falls back to deterministic rules.
 */
@Injectable()
export class CompositeAssignmentAssistProvider implements AssignmentAssistProvider {
  constructor(
    private readonly ml: MlAssignmentService,
    private readonly rules: RuleBasedAssignmentAssistProvider,
  ) {}

  async suggestPool(input: AssignmentAssistInput): Promise<AssignmentSuggestion | null> {
    const mlResult = await this.ml.suggestPool(input);
    if (mlResult) return mlResult;
    return this.rules.suggestPool(input);
  }
}
