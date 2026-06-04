import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, tap } from 'rxjs';
import { PrismaService } from '@/prisma/prisma.service';
import type { RequestWithContext } from '@/common/types/request-context';
import { AUDIT_META_KEY, type AuditMeta } from '@/common/decorators/audit.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta>(AUDIT_META_KEY, context.getHandler());
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest<RequestWithContext>();

    return next.handle().pipe(
      tap((response) => {
        void this.write(meta, request, response).catch((err) =>
          this.logger.error('Failed to record audit log', err),
        );
      }),
    );
  }

  private resolveResourceId(meta: AuditMeta, req: RequestWithContext, response: unknown): string | null {
    if (!meta.resourceIdFrom) return null;
    if (meta.resourceIdFrom === 'response.id') {
      const obj = response as { id?: string } | null;
      return obj?.id ?? null;
    }
    if (meta.resourceIdFrom.startsWith('params.')) {
      const key = meta.resourceIdFrom.slice('params.'.length);
      return (req.params?.[key] as string | undefined) ?? null;
    }
    return null;
  }

  private async write(meta: AuditMeta, req: RequestWithContext, response: unknown): Promise<void> {
    const ctx = req.ctx;
    if (!ctx) return;

    await this.prisma.auditLog.create({
      data: {
        condoId: ctx.user?.activeCondoId ?? null,
        actorUserId: ctx.user?.id ?? null,
        actorRole: ctx.user?.activeRole ?? null,
        action: meta.action,
        resourceType: meta.resourceType,
        resourceId: this.resolveResourceId(meta, req, response),
        ipAddress: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        metadata: {
          method: req.method,
          path: req.path,
          requestId: ctx.requestId,
        },
      },
    });
  }
}
