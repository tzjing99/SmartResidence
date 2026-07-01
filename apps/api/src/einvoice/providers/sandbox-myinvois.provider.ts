import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { validateEInvoiceDocument } from '../document-builder';
import type {
  MyInvoisCancelResult,
  MyInvoisCredentials,
  MyInvoisProvider,
  MyInvoisStatusResult,
  MyInvoisSubmitContext,
  MyInvoisSubmitResult,
} from './myinvois-provider.interface';

/** Public MyInvois verification base (real portal path; safe to link to). */
const SANDBOX_VERIFY_BASE = 'https://preprod.myinvois.hasil.gov.my';
const PRODUCTION_VERIFY_BASE = 'https://myinvois.hasil.gov.my';

/**
 * Default, network-free MyInvois provider. It deterministically "validates" a
 * submission: when the core required fields are present it returns a well-formed
 * (fake) uuid + longId, a verification URL/QR payload and marks the document
 * VALID; when required fields are missing it returns INVALID with the reason.
 *
 * This is clearly a SANDBOX/STUB — it performs NO real LHDN submission. A
 * production provider (real OAuth2 + MyInvois document API) implements the same
 * {@link MyInvoisProvider} interface and can be dropped in via the module.
 */
@Injectable()
export class SandboxMyInvoisProvider implements MyInvoisProvider {
  readonly id = 'sandbox';
  private readonly logger = new Logger(SandboxMyInvoisProvider.name);

  private verifyBase(environment: string): string {
    return environment === 'PRODUCTION' ? PRODUCTION_VERIFY_BASE : SANDBOX_VERIFY_BASE;
  }

  /** Deterministic long id derived from the invoice number so re-runs are stable. */
  private longIdFor(invoiceNumber: string): string {
    return createHash('sha256')
      .update(`myinvois-sandbox:${invoiceNumber}`)
      .digest('hex')
      .slice(0, 26)
      .toUpperCase();
  }

  async submit(ctx: MyInvoisSubmitContext): Promise<MyInvoisSubmitResult> {
    const missing = validateEInvoiceDocument(ctx.document);
    const uuid = randomUUID();
    if (missing.length > 0) {
      this.logger.warn(
        `[SANDBOX] Rejected e-invoice ${ctx.document.invoiceNumber}: missing ${missing.join(', ')}`,
      );
      return {
        uuid,
        status: 'INVALID',
        error: `Missing required fields: ${missing.join(', ')}`,
      };
    }

    const longId = this.longIdFor(ctx.document.invoiceNumber);
    const validationUrl = `${this.verifyBase(ctx.environment)}/${uuid}/share/${longId}`;
    this.logger.log(
      `[SANDBOX] Validated e-invoice ${ctx.document.invoiceNumber} -> ${uuid} (no network call)`,
    );
    return {
      uuid,
      longId,
      submissionUid: randomUUID().replace(/-/g, '').toUpperCase(),
      status: 'VALID',
      validationUrl,
      qrPayload: validationUrl,
    };
  }

  async getStatus(
    uuid: string,
    environment: string,
    _credentials?: MyInvoisCredentials,
  ): Promise<MyInvoisStatusResult> {
    // The sandbox has no server state; a submitted document is considered VALID.
    return {
      uuid,
      status: 'VALID',
      validationUrl: `${this.verifyBase(environment)}/${uuid}`,
    };
  }

  async cancel(
    uuid: string,
    reason: string,
    _environment: string,
    _credentials?: MyInvoisCredentials,
  ): Promise<MyInvoisCancelResult> {
    this.logger.log(`[SANDBOX] Cancelled e-invoice ${uuid}: ${reason || 'no reason'}`);
    return { uuid, status: 'CANCELLED' };
  }
}
