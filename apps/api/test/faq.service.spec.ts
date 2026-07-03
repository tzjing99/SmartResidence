import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FaqService } from '../src/faq/faq.service';

function service() {
  const prisma: any = {
    faqArticle: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    faqCategory: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  const cache: any = {
    wrap: (_k: string, _t: number, fn: () => unknown) => fn(),
    wrapNamespaced: (_ns: string, _k: string, _t: number, fn: () => unknown) => fn(),
    invalidateNamespace: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
  return { svc: new FaqService(prisma, cache), prisma };
}

const user: any = {
  id: 'admin1',
  roles: [{ roleId: 'MANAGEMENT_ADMIN', condoId: 'c1', unitId: null, permissions: [] }],
};

describe('FaqService', () => {
  it('creates an article with sensible defaults', async () => {
    const { svc, prisma } = service();
    prisma.faqArticle.create.mockImplementation(async (args: any) => ({ id: 'a1', ...args.data }));
    const a = await svc.createArticle(user, {
      condoId: 'c1',
      question: 'How do I pay fees?',
      answer: 'Via the billing page.',
    });
    expect((a as any).published).toBe(false);
    expect((a as any).pinned).toBe(false);
    expect((a as any).tags).toEqual([]);
    expect((a as any).authorUserId).toBe('admin1');
  });

  it('increments helpful count', async () => {
    const { svc, prisma } = service();
    prisma.faqArticle.findUnique.mockResolvedValueOnce({ id: 'a1', condoId: 'c1' });
    prisma.faqArticle.update.mockResolvedValueOnce({ id: 'a1', helpfulCount: 1 });
    await svc.markHelpful(user, 'a1');
    expect(prisma.faqArticle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { helpfulCount: { increment: 1 } } }),
    );
  });

  it('throws when an article is missing', async () => {
    const { svc, prisma } = service();
    prisma.faqArticle.findUnique.mockResolvedValueOnce(null);
    await expect(svc.getArticle(user, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('counts a view when requested', async () => {
    const { svc, prisma } = service();
    prisma.faqArticle.findUnique.mockResolvedValueOnce({ id: 'a1', condoId: 'c1' });
    prisma.faqArticle.update.mockResolvedValueOnce({ id: 'a1' });
    await svc.getArticle(user, 'a1', { countView: true });
    expect(prisma.faqArticle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { viewCount: { increment: 1 } } }),
    );
  });
});
