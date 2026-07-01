import { BillingModule } from '@/billing/billing.module';
import { QueueModule } from '@/queue/queue.module';
import { Module, forwardRef } from '@nestjs/common';
import { EInvoiceController } from './einvoice.controller';
import { EInvoiceService } from './einvoice.service';
import { DelegatingMyInvoisProvider } from './providers/delegating-myinvois.provider';
import { MYINVOIS_PROVIDER } from './providers/myinvois-provider.interface';
import { ProductionMyInvoisProvider } from './providers/production-myinvois.provider';
import { SandboxMyInvoisProvider } from './providers/sandbox-myinvois.provider';

/**
 * LHDN MyInvois e-invoicing. {@link MYINVOIS_PROVIDER} resolves to
 * {@link DelegatingMyInvoisProvider}, which routes per condo to the network-free
 * {@link SandboxMyInvoisProvider} or {@link ProductionMyInvoisProvider} based on
 * `environment` and stored API credentials. `SecretEncryptionService` is reused
 * from BillingModule to encrypt LHDN credentials at rest.
 */
@Module({
  imports: [BillingModule, forwardRef(() => QueueModule)],
  providers: [
    EInvoiceService,
    SandboxMyInvoisProvider,
    ProductionMyInvoisProvider,
    DelegatingMyInvoisProvider,
    { provide: MYINVOIS_PROVIDER, useExisting: DelegatingMyInvoisProvider },
  ],
  controllers: [EInvoiceController],
  exports: [EInvoiceService],
})
export class EInvoiceModule {}
