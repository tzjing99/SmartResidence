import type { EInvoiceEnvironment } from '@smartresidence/shared-types';

/**
 * LHDN MyInvois API hostnames (identity + e-invoicing API share the same base).
 * @see https://sdk.myinvois.hasil.gov.my/
 */
export const MYINVOIS_API_BASE: Record<EInvoiceEnvironment, string> = {
  SANDBOX: 'https://preprod-api.myinvois.hasil.gov.my',
  PRODUCTION: 'https://api.myinvois.hasil.gov.my',
};

/** Public verification portal (QR / share links). */
export const MYINVOIS_VERIFY_BASE: Record<EInvoiceEnvironment, string> = {
  SANDBOX: 'https://preprod.myinvois.hasil.gov.my',
  PRODUCTION: 'https://myinvois.hasil.gov.my',
};

export function myInvoisApiBase(environment: string): string {
  return environment === 'PRODUCTION' ? MYINVOIS_API_BASE.PRODUCTION : MYINVOIS_API_BASE.SANDBOX;
}

export function myInvoisVerifyBase(environment: string): string {
  return environment === 'PRODUCTION'
    ? MYINVOIS_VERIFY_BASE.PRODUCTION
    : MYINVOIS_VERIFY_BASE.SANDBOX;
}

export function myInvoisTokenUrl(environment: string): string {
  return `${myInvoisApiBase(environment)}/connect/token`;
}

export function myInvoisSubmissionUrl(environment: string): string {
  return `${myInvoisApiBase(environment)}/api/v1.0/documentsubmissions`;
}

export function myInvoisSubmissionStatusUrl(environment: string, submissionUid: string): string {
  return `${myInvoisApiBase(environment)}/api/v1.0/documentsubmissions/${encodeURIComponent(submissionUid)}`;
}

export function myInvoisDocumentDetailsUrl(environment: string, uuid: string): string {
  return `${myInvoisApiBase(environment)}/api/v1.0/documents/${encodeURIComponent(uuid)}/details`;
}

export function myInvoisCancelUrl(environment: string, uuid: string): string {
  return `${myInvoisApiBase(environment)}/api/v1.0/documents/state/${encodeURIComponent(uuid)}/state`;
}

export function myInvoisValidationUrl(environment: string, uuid: string, longId?: string): string {
  const base = myInvoisVerifyBase(environment);
  return longId ? `${base}/${uuid}/share/${longId}` : `${base}/${uuid}`;
}
