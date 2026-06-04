import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { AppEnv } from '@/config/env.schema';
import type { PaymentIntentResult, PaymentProviderAdapter } from './payment-provider.interface';

@Injectable()
export class StripeAdapter implements PaymentProviderAdapter {
  readonly id = 'STRIPE';
  private readonly logger = new Logger(StripeAdapter.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor(config: ConfigService<AppEnv, true>) {
    const key = config.get('STRIPE_SECRET_KEY', { infer: true });
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    this.stripe = key ? new Stripe(key, { apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion }) : null;
  }

  async createIntent(opts: Parameters<PaymentProviderAdapter['createIntent']>[0]): Promise<PaymentIntentResult> {
    if (!this.stripe) {
      this.logger.warn('Stripe not configured; returning mock client secret for dev.');
      return { clientSecret: 'pi_mock_client_secret', providerRef: `mock_${opts.payment.id}` };
    }
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(Number(opts.invoice.total) * 100),
      currency: opts.invoice.currencyCode.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentId: opts.payment.id,
        invoiceId: opts.invoice.id,
        condoId: opts.invoice.condoId,
      },
    });
    return { clientSecret: intent.client_secret ?? undefined, providerRef: intent.id };
  }

  async verifyWebhook(opts: Parameters<PaymentProviderAdapter['verifyWebhook']>[0]) {
    if (!this.stripe || !this.webhookSecret) return null;
    const sig = (opts.headers['stripe-signature'] as string | undefined) ?? '';
    const event = this.stripe.webhooks.constructEvent(opts.payload, sig, this.webhookSecret);
    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      return {
        providerRef: intent.id,
        succeeded: event.type === 'payment_intent.succeeded',
        raw: event,
      };
    }
    return null;
  }
}
