import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { BillingService } from './billing.service';

@ApiTags('Billing payments')
@ApiBearerAuth('access')
@Controller('billing/payments')
export class PaymentAdminController {
  constructor(private readonly billing: BillingService) {}

  @Get('condo/:condoId/issues')
  @CheckAbility({ action: 'read', subject: 'Payment' })
  @ApiOperation({ summary: 'Failed or flagged gateway payments needing admin attention' })
  listIssues(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.billing.listPaymentIssues(user, condoId);
  }

  @Post(':id/dismiss')
  @CheckAbility({ action: 'manage', subject: 'Payment' })
  @Audit({ action: AuditAction.UPDATE, resourceType: 'Payment', resourceIdFrom: 'params.id' })
  @ApiOperation({ summary: 'Dismiss a failed or flagged pending payment attempt' })
  dismiss(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.billing.dismissPayment(user, id);
  }

  @Post(':id/approve-review')
  @CheckAbility({ action: 'manage', subject: 'Payment' })
  @Audit({ action: AuditAction.PAYMENT, resourceType: 'Payment', resourceIdFrom: 'params.id' })
  @ApiOperation({
    summary: 'Manually approve a flagged payment after verifying the gateway settlement',
  })
  approveReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.billing.approveReviewedPayment(user, id);
  }
}
