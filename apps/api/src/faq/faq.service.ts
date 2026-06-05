import type { AuthenticatedUser } from '@/common/types/request-context';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateFaqArticleDto,
  CreateFaqCategoryDto,
  ListFaqDto,
  UpdateFaqArticleDto,
  UpdateFaqCategoryDto,
} from './dto/faq.dto';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  /** Turn a free-text query into a Postgres tsquery-friendly string. */
  private toSearch(q: string | undefined): string | undefined {
    if (!q) return undefined;
    const terms = q
      .trim()
      .split(/\s+/)
      .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(Boolean);
    return terms.length ? terms.join(' & ') : undefined;
  }

  // -- categories ----------------------------------------------------

  listCategories(condoId: string) {
    return this.prisma.faqCategory.findMany({
      where: { condoId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  createCategory(dto: CreateFaqCategoryDto) {
    return this.prisma.faqCategory.create({
      data: { condoId: dto.condoId, name: dto.name, position: dto.position ?? 0 },
    });
  }

  async updateCategory(id: string, dto: UpdateFaqCategoryDto) {
    await this.ensureCategory(id);
    return this.prisma.faqCategory.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string) {
    await this.ensureCategory(id);
    await this.prisma.faqCategory.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureCategory(id: string) {
    const c = await this.prisma.faqCategory.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  // -- articles ------------------------------------------------------

  async listPublished(condoId: string, dto: ListFaqDto) {
    const search = this.toSearch(dto.q);
    const where: Prisma.FaqArticleWhereInput = {
      condoId,
      published: true,
      ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
      ...(search ? { OR: [{ question: { search } }, { answer: { search } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.faqArticle.findMany({
        where,
        include: { category: true },
        orderBy: [{ pinned: 'desc' }, { position: 'asc' }, { helpfulCount: 'desc' }],
        take: dto.limit,
        skip: dto.offset,
      }),
      this.prisma.faqArticle.count({ where }),
    ]);
    return { items, total, limit: dto.limit, offset: dto.offset };
  }

  async listAll(condoId: string, dto: ListFaqDto) {
    const where: Prisma.FaqArticleWhereInput = {
      condoId,
      ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.faqArticle.findMany({
        where,
        include: { category: true, author: { select: { id: true, name: true } } },
        orderBy: [{ pinned: 'desc' }, { position: 'asc' }, { createdAt: 'desc' }],
        take: dto.limit,
        skip: dto.offset,
      }),
      this.prisma.faqArticle.count({ where }),
    ]);
    return { items, total, limit: dto.limit, offset: dto.offset };
  }

  async getArticle(id: string, opts: { countView?: boolean } = {}) {
    const article = await this.prisma.faqArticle.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!article) throw new NotFoundException();
    if (opts.countView) {
      await this.prisma.faqArticle.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    }
    return article;
  }

  createArticle(user: AuthenticatedUser, dto: CreateFaqArticleDto) {
    return this.prisma.faqArticle.create({
      data: {
        condoId: dto.condoId,
        categoryId: dto.categoryId ?? null,
        question: dto.question,
        answer: dto.answer,
        tags: dto.tags ?? [],
        published: dto.published ?? false,
        pinned: dto.pinned ?? false,
        position: dto.position ?? 0,
        authorUserId: user.id,
      },
    });
  }

  async updateArticle(id: string, dto: UpdateFaqArticleDto) {
    await this.getArticle(id);
    return this.prisma.faqArticle.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.question !== undefined ? { question: dto.question } : {}),
        ...(dto.answer !== undefined ? { answer: dto.answer } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
        ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
  }

  async deleteArticle(id: string) {
    await this.getArticle(id);
    await this.prisma.faqArticle.delete({ where: { id } });
    return { ok: true };
  }

  async markHelpful(id: string) {
    await this.getArticle(id);
    return this.prisma.faqArticle.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });
  }

  /** Token overlap score for F4 deflection matching. */
  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
  }

  private overlapScore(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let hit = 0;
    for (const t of a) if (b.has(t)) hit++;
    return hit / Math.max(a.size, b.size);
  }

  /**
   * F4: strong FAQ match for compose deflection.
   * Returns top article when question tokens overlap strongly with FAQ question/answer.
   */
  async matchForDeflection(condoId: string, subject: string, body: string) {
    const queryTokens = this.tokenize(`${subject} ${body}`);
    if (queryTokens.size === 0) return { match: null as null };

    const articles = await this.prisma.faqArticle.findMany({
      where: { condoId, published: true },
      include: { category: true },
      orderBy: [{ pinned: 'desc' }, { helpfulCount: 'desc' }],
      take: 50,
    });

    let best: (typeof articles)[number] | null = null;
    let bestScore = 0;
    for (const article of articles) {
      const qTokens = this.tokenize(article.question);
      const aTokens = this.tokenize(article.answer);
      const score = Math.max(
        this.overlapScore(queryTokens, qTokens),
        this.overlapScore(queryTokens, aTokens) * 0.85,
      );
      if (score > bestScore) {
        bestScore = score;
        best = article;
      }
    }

    const STRONG_THRESHOLD = 0.45;
    if (!best || bestScore < STRONG_THRESHOLD) return { match: null as null };

    return {
      match: {
        articleId: best.id,
        question: best.question,
        answer: best.answer,
        score: Math.round(bestScore * 100) / 100,
        category: best.category?.name ?? null,
      },
    };
  }
}
