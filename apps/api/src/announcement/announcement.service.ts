import type { AuthenticatedUser } from '@/common/types/request-context';
import type { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { CreateAnnouncementDto } from './dto/announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(condoId: string, opts: { limit: number; offset: number }) {
    const where = {
      condoId,
      OR: [{ publishedAt: { not: null, lte: new Date() } }, { publishedAt: null }],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        include: { author: true, _count: { select: { acks: true } } },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { items, total, ...opts };
  }

  async create(user: AuthenticatedUser, dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.announcement.create({
      data: {
        condoId: dto.condoId,
        authorUserId: user.id,
        title: dto.title,
        body: dto.body,
        importance: dto.importance ?? 'INFO',
        audience: (dto.audience ?? { all: true }) as object,
        publishedAt: dto.publishedAt ?? new Date(),
        expiresAt: dto.expiresAt,
        requiresAck: dto.requiresAck ?? false,
        pinned: dto.pinned ?? false,
      },
    });
    this.events.emit('announcement.published', {
      announcementId: announcement.id,
      condoId: announcement.condoId,
    });
    return announcement;
  }

  async acknowledge(user: AuthenticatedUser, announcementId: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });
    if (!announcement) throw new NotFoundException();
    return this.prisma.announcementAck.upsert({
      where: { announcementId_userId: { announcementId, userId: user.id } },
      update: {},
      create: { announcementId, userId: user.id },
    });
  }
}
