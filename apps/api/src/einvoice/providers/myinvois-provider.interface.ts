import type { EInvoiceDocument, EInvoiceStatus } from '@smartresidence/shared-types';

/** Decrypted, non-persisted LHDN MyInvois API credentials passed per request. */
export interface MyInvoisCredentials {
  clientId?: string;
  clientSecret?: string;
}

export interface MyInvoisSubmitContext {
  document: EInvoiceDocument;
  environment: string;
  credentials?: MyInvoisCredentials;
}

export interface MyInvoisSubmitResult {
  uuid: string;
  longId?: string;
  submissionUid?: string;
  status: EInvoiceStatus;
  qrPayload?: string;
  validationUrl?: string;
  error?: string;
}

export interface MyInvoisStatusResult {
  uuid: string;
  status: EInvoiceStatus;
  longId?: string;
  validationUrl?: string;
  error?: string;
}

export interface MyInvoisCancelResult {
  uuid: string;
  status: EInvoiceStatus;
  error?: string;
}

/**
 * Provider seam for LHDN MyInvois. The default {@link SandboxMyInvoisProvider}
 * validates locally with no network; a production provider implements the same
 * interface against the real MyInvois OAuth2 + document submission API.
 */
export interface MyInvoisProvider {
  readonly id: string;
  submit(ctx: MyInvoisSubmitContext): Promise<MyInvoisSubmitResult>;
  getStatus(uuid: string, environment: string): Promise<MyInvoisStatusResult>;
  cancel(uuid: string, reason: string, environment: string): Promise<MyInvoisCancelResult>;
}

export const MYINVOIS_PROVIDER = Symbol('MYINVOIS_PROVIDER');
