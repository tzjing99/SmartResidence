import { BillingModule } from '@/billing/billing.module';
import { Module } from '@nestjs/common';
import { EInvoiceController } from './einvoice.controller';
import { EInvoiceService } from './einvoice.service';
import { MYINVOIS_PROVIDER } from './providers/myinvois-provider.interface';
import { SandboxMyInvoisProvider } from './providers/sandbox-myinvois.provider';

/**
 * LHDN MyInvois e-invoicing. The provider seam ({@link MYINVOIS_PROVIDER}) binds
 * to the network-free {@link SandboxMyInvoisProvider} by default; swap the
 * `useClass` for a production MyInvois client (OAuth2 + document API) to go live.
 * `SecretEncryptionService` is reused from BillingModule to encrypt LHDN API
 * credentials at rest.
 */
@Module({
  imports: [BillingModule],
  providers: [
    EInvoiceService,
    SandboxMyInvoisProvider,
    { provide: MYINVOIS_PROVIDER, useExisting: SandboxMyInvoisProvider },
  ],
  controllers: [EInvoiceController],
  exports: [EInvoiceService],
})
export class EInvoiceModule {}
