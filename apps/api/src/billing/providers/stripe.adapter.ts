import type { AppEnv } from '@/config/env.schema';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type {
  PaymentIntentOptions,
  PaymentIntentResult,
  PaymentProviderAdapter,
  WebhookVerifyOptions,
} from './payment-provider.interface';

const API_VERSION = '2024-11-20.acacia' as Stripe.LatestApiVersion;

@Injectable()
export class StripeAdapter implements PaymentProviderAdapter {
  readonly id = 'STRIPE';
  private readonly logger = new Logger(StripeAdapter.name);
  private readonly envStripe: Stripe | null;
  private readonly envWebhookSecret: string | undefined;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<AppEnv, true>) {
    const key = config.get('STRIPE_SECRET_KEY', { infer: true });
    this.envWebhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    this.envStripe = key ? new Stripe(key, { apiVersion: API_VERSION }) : null;
  }

  /** Resolve a Stripe client from per-condo credentials, falling back to env. */
  private clientFor(credentials?: Record<string, string>): Stripe | null {
    if (credentials?.secretKey) {
      return new Stripe(credentials.secretKey, { apiVersion: API_VERSION });
    }
    return this.envStripe;
  }

  async createIntent(opts: PaymentIntentOptions): Promise<PaymentIntentResult> {
    const stripe = this.clientFor(opts.credentials);
    if (!stripe) {
      this.logger.warn('Stripe not configured; returning mock client secret for dev.');
      return { clientSecret: 'pi_mock_client_secret', providerRef: `mock_${opts.payment.id}` };
    }
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(opts.payment.amount) * 100),
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

  async verifyWebhook(opts: WebhookVerifyOptions) {
    const stripe = this.clientFor(opts.credentials);
    const webhookSecret = opts.credentials?.webhookSecret ?? this.envWebhookSecret;
    if (!stripe || !webhookSecret) return null;
    const sig = (opts.headers['stripe-signature'] as string | undefined) ?? '';
    const event = stripe.webhooks.constructEvent(opts.payload, sig, webhookSecret);
    if (
      event.type === 'payment_intent.succeeded' ||
      event.type === 'payment_intent.payment_failed'
    ) {
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
