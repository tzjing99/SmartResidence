import { Injectable } from '@nestjs/common';
import type { ThreadCategory, ThreadPriority } from '@prisma/client';
import { ThreadPriorityService } from '../sla/thread-priority.service';

/**
 * DI token for the active AI-assist implementation. Bind a different provider
 * (e.g. an Ollama-backed one) in ThreadsModule to enable local AI features
 * without touching the rest of the codebase.
 */
export const AI_ASSIST_PROVIDER = Symbol('AI_ASSIST_PROVIDER');

export interface AiAssistInput {
  subject: string;
  body: string;
  category: ThreadCategory;
}

export interface AiThreadMessage {
  role: 'resident' | 'management';
  body: string;
}

/**
 * The seam for optional, self-hostable AI assistance over threads + FAQ.
 * v1 ships a deterministic rules-based implementation; everything beyond
 * priority suggestion returns null so callers degrade gracefully.
 */
export interface AiAssistProvider {
  /** Suggest a priority for a newly opened thread. */
  suggestPriority(input: AiAssistInput): Promise<ThreadPriority>;
  /** Suggest a category from free text (null = no suggestion). */
  suggestCategory(input: { subject: string; body: string }): Promise<ThreadCategory | null>;
  /** Draft a reply for management to review (null = unavailable). */
  suggestReply(input: { subject: string; messages: AiThreadMessage[] }): Promise<string | null>;
  /** Summarise a long thread (null = unavailable). */
  summarizeThread(input: { subject: string; messages: AiThreadMessage[] }): Promise<string | null>;
  /** Answer a resident question from the FAQ via retrieval (null = no match). */
  answerFromFaq(input: {
    question: string;
    faq: Array<{ id: string; question: string; answer: string }>;
  }): Promise<{ answer: string; articleId: string } | null>;
}

/**
 * Default provider: delegates priority to the deterministic rules engine and
 * returns null for the generative features. No model is loaded or shipped.
 */
@Injectable()
export class RuleBasedAiAssistProvider implements AiAssistProvider {
  constructor(private readonly priority: ThreadPriorityService) {}

  async suggestPriority(input: AiAssistInput): Promise<ThreadPriority> {
    return this.priority.suggest(input);
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
