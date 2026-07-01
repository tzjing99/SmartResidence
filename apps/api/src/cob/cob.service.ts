import { isManagementForCondo } from '@/announcement/announcement-audience';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleId } from '@prisma/client';
import { COB_TEMPLATE_SLUG, type CobTemplateKind } from '@smartresidence/shared-types';
import { buildCobTemplatePdf } from './cob-pdf';
import { CobPrefillService } from './cob-prefill';

@Injectable()
export class CobService {
  constructor(private readonly prefill: CobPrefillService) {}

  private assertManagement(user: AuthenticatedUser, condoId: string): void {
    const isSuperAdmin = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN);
    if (isSuperAdmin || isManagementForCondo(user, condoId)) return;
    throw new ForbiddenException('Management access required');
  }

  listTemplates(user: AuthenticatedUser, condoId: string, from?: string, to?: string) {
    this.assertManagement(user, condoId);
    return this.prefill.listTemplates(condoId, from, to);
  }

  async generatePdf(
    user: AuthenticatedUser,
    condoId: string,
    kindSlug: string,
    from?: string,
    to?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    this.assertManagement(user, condoId);
    const kind = this.prefill.slugToKind(kindSlug);
    if (!kind) {
      throw new BadRequestException(
        `Unknown template kind. Expected one of: ${Object.values(COB_TEMPLATE_SLUG).join(', ')}`,
      );
    }
    const ctx = await this.prefill.buildContext(condoId, from, to);
    const buffer = buildCobTemplatePdf(kind, ctx);
    const filename = `cob-${COB_TEMPLATE_SLUG[kind as CobTemplateKind]}-${ctx.asAtDate.toISOString().slice(0, 10)}.pdf`;
    if (!buffer?.length) throw new NotFoundException('Failed to generate PDF');
    return { buffer, filename };
  }
}
