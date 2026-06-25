import { Injectable } from '@nestjs/common';
import type { ThreadCategory } from '@prisma/client';
import { MlPriorityService } from '../ml/ml-priority.service';
import { ThreadPriorityService } from '../sla/thread-priority.service';
import type { AiAssistInput, AiAssistProvider, PrioritySuggestion } from './ai-assist.provider';

/**
 * Default production provider: deterministic safety rules + optional per-condo ML
 * priority (C6). Generative features remain unavailable until a model backend is wired.
 */
@Injectable()
export class CompositeAiAssistProvider implements AiAssistProvider {
  constructor(
    private readonly mlPriority: MlPriorityService,
    private readonly rules: ThreadPriorityService,
  ) {}

  async suggestPriority(input: AiAssistInput): Promise<PrioritySuggestion> {
    if (!input.condoId) {
      return { priority: this.rules.suggest(input), source: 'rules' };
    }
    return this.mlPriority.suggest({
      condoId: input.condoId,
      subject: input.subject,
      body: input.body,
      category: input.category,
    });
  }

  async suggestCategory(): Promise<ThreadCategory | null> {
    return null;
  }

  async suggestReply(): Promise<string | null> {
    return null;
  }

  async summarizeThread(): Promise<string | null> {
    return null;
  }

  async answerFromFaq(): Promise<{ answer: string; articleId: string } | null> {
    return null;
  }
}
