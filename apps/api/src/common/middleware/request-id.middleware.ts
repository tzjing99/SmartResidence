import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import type { RequestWithContext } from '@/common/types/request-context';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const requestId = (Array.isArray(incoming) ? incoming[0] : incoming) || nanoid(12);

    req.ctx ??= {
      requestId,
      user: null,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    };
    req.ctx.requestId = requestId;

    res.setHeader('x-request-id', requestId);
    next();
  }
}
