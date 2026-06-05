import { Module } from '@nestjs/common';
import { BillingController, PaymentWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { FpxAdapter } from './providers/fpx.adapter';
import { StripeAdapter } from './providers/stripe.adapter';

@Module({
  providers: [BillingService, StripeAdapter, FpxAdapter],
  controllers: [BillingController, PaymentWebhookController],
  exports: [BillingService],
})
export class BillingModule {}
