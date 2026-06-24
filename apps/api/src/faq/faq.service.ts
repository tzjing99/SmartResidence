import { CacheService } from '@/cache/cache.service';
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

/** FAQ content is read-heavy (resident-facing) and changes rarely. */
const FAQ_CATEGORIES_TTL = 120;
const FAQ_PUBLISHED_TTL = 60;

@Injectable()
export class FaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Per-condo cache namespace; bumped on any FAQ write to invalidate reads. */
  private faqNamespace(condoId: string): string {
    return `faq:${condoId}`;
  }

  private async invalidate(condoId: string): Promise<void> {
    await this.cache.invalidateNamespace(this.faqNamespace(condoId));
  }

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
    return this.cache.wrapNamespaced(this.faqNamespace(condoId), 'categories', FAQ_CATEGORIES_TTL, () =>
      this.prisma.faqCategory.findMany({
        where: { condoId },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
    );
  }

  async createCategory(dto: CreateFaqCategoryDto) {
    const created = await this.prisma.faqCategory.create({
      data: { condoId: dto.condoId, name: dto.name, position: dto.position ?? 0 },
    });
    await this.invalidate(dto.condoId);
    return created;
  }

  async updateCategory(id: string, dto: UpdateFaqCategoryDto) {
    const existing = await this.ensureCategory(id);
    const updated = await this.prisma.faqCategory.update({ where: { id }, data: dto });
    await this.invalidate(existing.condoId);
    return updated;
  }

  async deleteCategory(id: string) {
    const existing = await this.ensureCategory(id);
    await this.prisma.faqCategory.delete({ where: { id } });
    await this.invalidate(existing.condoId);
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
    const keySuffix = `published:${JSON.stringify({
      categoryId: dto.categoryId ?? null,
      q: search ?? null,
      limit: dto.limit,
      offset: dto.offset,
    })}`;
    return this.cache.wrapNamespaced(this.faqNamespace(condoId), keySuffix, FAQ_PUBLISHED_TTL, async () => {
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
    });
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

  async createArticle(user: AuthenticatedUser, dto: CreateFaqArticleDto) {
    const created = await this.prisma.faqArticle.create({
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
    await this.invalidate(dto.condoId);
    return created;
  }

  async updateArticle(id: string, dto: UpdateFaqArticleDto) {
    const existing = await this.getArticle(id);
    const updated = await this.prisma.faqArticle.update({
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
    await this.invalidate(existing.condoId);
    return updated;
  }

  async deleteArticle(id: string) {
    const existing = await this.getArticle(id);
    await this.prisma.faqArticle.delete({ where: { id } });
    await this.invalidate(existing.condoId);
    return { ok: true };
  }

  async markHelpful(id: string) {
    const existing = await this.getArticle(id);
    const updated = await this.prisma.faqArticle.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });
    await this.invalidate(existing.condoId);
    return updated;
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
