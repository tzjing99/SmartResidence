import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Wraps successful responses in `{ data, meta }` shape so clients have a
 * stable envelope. Skipped for SSE / file streams via the `Bypass` reflector
 * (set by `@SkipTransform()` if needed).
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<{ data: T }> {
    return next.handle().pipe(map((value) => ({ data: value })));
  }
}
