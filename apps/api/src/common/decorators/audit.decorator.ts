import { SetMetadata } from '@nestjs/common';
import type { AuditAction } from '@prisma/client';

export const AUDIT_META_KEY = 'sr:audit';

export interface AuditMeta {
  action: AuditAction;
  resourceType: string;
  /** Path on the response body (or input args) that resolves the resource id. */
  resourceIdFrom?: 'response.id' | 'params.id' | string;
}

/**
 * Marks a handler so the AuditLogInterceptor records an entry on success.
 *
 * @example
 *   @Audit({ action: 'CREATE', resourceType: 'Visitor', resourceIdFrom: 'response.id' })
 */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_META_KEY, meta);
