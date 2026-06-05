import { Injectable } from '@nestjs/common';
import { ThreadCategory, ThreadPriority } from '@prisma/client';

/**
 * Deterministic, rules-based priority suggestion. This is intentionally simple
 * and auditable: a keyword/category map, no ML. The pluggable AiAssistProvider
 * (see ../ai/ai-assist.provider.ts) can later override these suggestions, but
 * the rules below are always the safe default and the management user can
 * override the result manually.
 */
@Injectable()
export class ThreadPriorityService {
  /** Words that almost always indicate a life-safety / emergency situation. */
  private static readonly URGENT_KEYWORDS = [
    'fire',
    'smoke',
    'gas leak',
    'gas smell',
    'flood',
    'flooding',
    'burst pipe',
    'burst',
    'no water',
    'water cut',
    'power outage',
    'no power',
    'blackout',
    'electric shock',
    'sparking',
    'short circuit',
    'lift trapped',
    'trapped in lift',
    'stuck in lift',
    'elevator trapped',
    'sewage',
    'emergency',
    'danger',
    'injured',
    'injury',
    'collapse',
    'break-in',
    'intruder',
  ];

  /** Words that indicate a pressing-but-not-emergency issue. */
  private static readonly HIGH_KEYWORDS = [
    'leak',
    'leaking',
    'not working',
    'broken',
    'urgent',
    'asap',
    'overflow',
    'blocked',
    'clogged',
    'pest',
    'infestation',
    'theft',
    'stolen',
    'harassment',
    'threat',
    'unsafe',
  ];

  suggest(input: { subject: string; body: string; category: ThreadCategory }): ThreadPriority {
    const text = `${input.subject} ${input.body}`.toLowerCase();

    if (ThreadPriorityService.URGENT_KEYWORDS.some((k) => text.includes(k))) {
      return ThreadPriority.URGENT;
    }
    // Security issues are at least HIGH regardless of wording.
    if (input.category === ThreadCategory.SECURITY) {
      return ThreadPriority.HIGH;
    }
    if (ThreadPriorityService.HIGH_KEYWORDS.some((k) => text.includes(k))) {
      return ThreadPriority.HIGH;
    }
    if (input.category === ThreadCategory.SUGGESTION) {
      return ThreadPriority.LOW;
    }
    return ThreadPriority.NORMAL;
  }
}
