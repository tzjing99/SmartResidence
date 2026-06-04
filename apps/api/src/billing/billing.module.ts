import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController, PaymentWebhookController } from './billing.controller';
import { StripeAdapter } from './providers/stripe.adapter';
import { FpxAdapter } from './providers/fpx.adapter';

@Module({
  providers: [BillingService, StripeAdapter, FpxAdapter],
  controllers: [BillingController, PaymentWebhookController],
  exports: [BillingService],
})
export class BillingModule {}
