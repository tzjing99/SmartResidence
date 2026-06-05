import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client wrapper that exposes:
 *
 *  - `withTenantContext(ctx, fn)` — runs `fn` inside a transaction with
 *    `app.current_user_id` / `app.current_condo_id` / `app.current_role`
 *    Postgres GUC variables set, so RLS policies apply.
 *
 *  - `asService(fn)` — runs `fn` with `app.current_role = 'SERVICE'`,
 *    bypassing RLS for trusted background work.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async withTenantContext<T>(
    ctx: { userId?: string | null; condoId?: string | null; role?: string | null },
    fn: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.current_user_id', $1, true)",
        ctx.userId ?? '',
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.current_condo_id', $1, true)",
        ctx.condoId ?? '',
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.current_role', $1, true)",
        ctx.role ?? 'GUEST',
      );
      return fn(tx as PrismaClient);
    });
  }

  async asService<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.withTenantContext({ role: 'SERVICE' }, fn);
  }
}
