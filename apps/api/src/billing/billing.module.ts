import { AccountingModule } from '@/accounting/accounting.module';
import { Module } from '@nestjs/common';
import { AutomationStatusController } from './automation-status.controller';
import { AutomationStatusService } from './automation-status.service';
import { BillingAutomationScheduleService } from './billing-automation-schedule.service';
import { BillingAutomationService } from './billing-automation.service';
import { BillingExportsService } from './billing-exports.service';
import { BillingSettingsController } from './billing-settings.controller';
import { BillingSettingsService } from './billing-settings.service';
import { BillingController, PaymentWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { SecretEncryptionService } from './crypto/secret-encryption.service';
import { DepositController } from './deposit.controller';
import { DepositService } from './deposit.service';
import { FeeScheduleService } from './fee-schedule.service';
import { GatewayConnectionService } from './gateway-connection.service';
import { GatewayController } from './gateway.controller';
import { LedgerService } from './ledger.service';
import { PaymentAdminController } from './payment-admin.controller';
import { DuitNowAdapter } from './providers/duitnow.adapter';
import { FiuuAdapter } from './providers/fiuu.adapter';
import { FpxAdapter } from './providers/fpx.adapter';
import { IPay88Adapter } from './providers/ipay88.adapter';
import { StripeAdapter } from './providers/stripe.adapter';
import { TngAdapter } from './providers/tng.adapter';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [AccountingModule],
  providers: [
    BillingService,
    AutomationStatusService,
    StripeAdapter,
    FpxAdapter,
    FiuuAdapter,
    IPay88Adapter,
    DuitNowAdapter,
    TngAdapter,
    ReceiptService,
    DepositService,
    FeeScheduleService,
    BillingAutomationService,
    BillingExportsService,
    BillingAutomationScheduleService,
    BillingSettingsService,
    LedgerService,
    SecretEncryptionService,
    GatewayConnectionService,
  ],
  controllers: [
    BillingController,
    PaymentWebhookController,
    DepositController,
    ReceiptController,
    BillingSettingsController,
    ReportsController,
    PaymentAdminController,
    GatewayController,
    AutomationStatusController,
  ],
  exports: [
    BillingService,
    ReceiptService,
    DepositService,
    FeeScheduleService,
    LedgerService,
    AutomationStatusService,
    SecretEncryptionService,
  ],
})
export class BillingModule {}
