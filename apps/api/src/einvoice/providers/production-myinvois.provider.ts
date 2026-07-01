import { Injectable, Logger, Optional } from '@nestjs/common';
import { validateEInvoiceDocument } from '../document-builder';
import {
  myInvoisCancelUrl,
  myInvoisDocumentDetailsUrl,
  myInvoisSubmissionStatusUrl,
  myInvoisSubmissionUrl,
  myInvoisValidationUrl,
} from './myinvois-api.config';
import { encodeMyInvoisDocument } from './myinvois-document.mapper';
import { type FetchFn, fetchMyInvoisAccessToken } from './myinvois-oauth.client';
import type {
  MyInvoisCancelResult,
  MyInvoisCredentials,
  MyInvoisProvider,
  MyInvoisStatusResult,
  MyInvoisSubmitContext,
  MyInvoisSubmitResult,
} from './myinvois-provider.interface';
import {
  mapMyInvoisStatus,
  parseApiError,
  parseCancelResponse,
  parseDocumentDetailsResponse,
  parseSubmissionResponse,
  parseSubmissionStatusResponse,
} from './myinvois-response.parser';

const STATUS_POLL_ATTEMPTS = 3;
const STATUS_POLL_DELAY_MS = 800;

/**
 * Live LHDN MyInvois provider: OAuth2 client credentials, document submission,
 * submission polling, and cancellation against the MyInvois REST API.
 *
 * Requires valid API credentials stored encrypted in condo settings. Digital
 * signing of the UBL/JSON payload is not implemented yet — LHDN may reject
 * unsigned documents until that step is added.
 */
@Injectable()
export class ProductionMyInvoisProvider implements MyInvoisProvider {
  readonly id = 'production';
  private readonly logger = new Logger(ProductionMyInvoisProvider.name);
  private readonly fetchImpl: FetchFn;

  /** Optional fetch override for unit tests; Nest injects undefined in production. */
  constructor(@Optional() fetchImpl?: FetchFn) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async submit(ctx: MyInvoisSubmitContext): Promise<MyInvoisSubmitResult> {
    const missing = validateEInvoiceDocument(ctx.document);
    if (missing.length > 0) {
      return {
        uuid: '',
        status: 'INVALID',
        error: `Missing required fields: ${missing.join(', ')}`,
      };
    }

    if (!ctx.credentials?.clientId || !ctx.credentials?.clientSecret) {
      return {
        uuid: '',
        status: 'INVALID',
        error: 'LHDN API client id and secret are required for production submission',
      };
    }

    try {
      const token = await fetchMyInvoisAccessToken(
        ctx.environment,
        ctx.credentials,
        this.fetchImpl,
      );
      const encoded = encodeMyInvoisDocument(ctx.document);

      const res = await this.fetchImpl(myInvoisSubmissionUrl(ctx.environment), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          documents: [encoded],
        }),
      });

      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = parseApiError(body, `Document submission failed (${res.status})`);
        this.logger.warn(`MyInvois submit failed: ${msg}`);
        return { uuid: '', status: 'INVALID', error: msg };
      }

      const parsed = parseSubmissionResponse(body);
      if (parsed.status === 'INVALID') {
        return {
          uuid: parsed.uuid ?? '',
          status: 'INVALID',
          submissionUid: parsed.submissionUid,
          error: parsed.error,
        };
      }

      if (parsed.submissionUid) {
        const polled = await this.pollSubmission(
          ctx.environment,
          ctx.credentials,
          parsed.submissionUid,
          parsed.uuid,
          parsed.longId,
        );
        return polled;
      }

      if (parsed.uuid) {
        const details = await this.fetchDocumentDetails(
          ctx.environment,
          ctx.credentials,
          parsed.uuid,
        );
        const validationUrl = myInvoisValidationUrl(
          ctx.environment,
          parsed.uuid,
          details.longId ?? parsed.longId,
        );
        return {
          uuid: parsed.uuid,
          longId: details.longId ?? parsed.longId,
          status: details.status,
          validationUrl,
          qrPayload: validationUrl,
        };
      }

      return {
        uuid: '',
        status: 'INVALID',
        error: 'Submission accepted but no document identifier was returned',
      };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`MyInvois submit error: ${msg}`);
      return { uuid: '', status: 'INVALID', error: msg };
    }
  }

  async getStatus(
    uuid: string,
    environment: string,
    credentials?: MyInvoisCredentials,
  ): Promise<MyInvoisStatusResult> {
    if (!credentials?.clientId || !credentials?.clientSecret) {
      return { uuid, status: 'INVALID', error: 'LHDN API credentials required' };
    }

    try {
      const details = await this.fetchDocumentDetails(environment, credentials, uuid);
      const validationUrl = myInvoisValidationUrl(environment, uuid, details.longId);
      return {
        uuid,
        status: details.status,
        longId: details.longId,
        validationUrl,
        error: details.validationErrors?.join('; '),
      };
    } catch (err) {
      return { uuid, status: 'INVALID', error: (err as Error).message };
    }
  }

  async cancel(
    uuid: string,
    reason: string,
    environment: string,
    credentials?: MyInvoisCredentials,
  ): Promise<MyInvoisCancelResult> {
    if (!credentials?.clientId || !credentials?.clientSecret) {
      return { uuid, status: 'INVALID', error: 'LHDN API credentials required' };
    }

    try {
      const token = await fetchMyInvoisAccessToken(environment, credentials, this.fetchImpl);
      const res = await this.fetchImpl(myInvoisCancelUrl(environment, uuid), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          status: 'cancelled',
          reason: (reason || 'Cancelled by management').slice(0, 300),
        }),
      });

      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = parseApiError(body, `Cancel failed (${res.status})`);
        return { uuid, status: 'INVALID', error: msg };
      }

      const parsed = parseCancelResponse(body);
      return { uuid: parsed.uuid ?? uuid, status: parsed.status, error: parsed.error };
    } catch (err) {
      return { uuid, status: 'INVALID', error: (err as Error).message };
    }
  }

  private async pollSubmission(
    environment: string,
    credentials: MyInvoisCredentials,
    submissionUid: string,
    initialUuid?: string,
    initialLongId?: string,
  ): Promise<MyInvoisSubmitResult> {
    let lastUuid = initialUuid;
    let lastLongId = initialLongId;
    let lastStatus = mapMyInvoisStatus('submitted');

    for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await sleep(STATUS_POLL_DELAY_MS);
      }

      const token = await fetchMyInvoisAccessToken(environment, credentials, this.fetchImpl);
      const res = await this.fetchImpl(myInvoisSubmissionStatusUrl(environment, submissionUid), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = parseApiError(body, `Submission status poll failed (${res.status})`);
        return {
          uuid: lastUuid ?? '',
          submissionUid,
          status: 'INVALID',
          error: msg,
        };
      }

      const parsed = parseSubmissionStatusResponse(body);
      lastStatus = mapMyInvoisStatus(parsed.overallStatus);

      const doc = parsed.documents[0];
      if (doc?.uuid) lastUuid = doc.uuid;
      if (doc?.longId) lastLongId = doc.longId;
      if (doc?.status) lastStatus = mapMyInvoisStatus(doc.status);
      if (doc?.error) {
        return {
          uuid: lastUuid ?? '',
          longId: lastLongId,
          submissionUid,
          status: 'INVALID',
          error: doc.error,
        };
      }

      if (lastStatus === 'VALID' || lastStatus === 'INVALID') break;
    }

    if (lastUuid && lastStatus !== 'INVALID') {
      const details = await this.fetchDocumentDetails(environment, credentials, lastUuid);
      if (details.status) lastStatus = details.status;
      if (details.longId) lastLongId = details.longId;
      if (details.validationErrors?.length) {
        return {
          uuid: lastUuid,
          longId: lastLongId,
          submissionUid,
          status: 'INVALID',
          error: details.validationErrors.join('; '),
        };
      }
    }

    const validationUrl =
      lastUuid && lastLongId
        ? myInvoisValidationUrl(environment, lastUuid, lastLongId)
        : lastUuid
          ? myInvoisValidationUrl(environment, lastUuid)
          : undefined;

    return {
      uuid: lastUuid ?? '',
      longId: lastLongId,
      submissionUid,
      status: lastStatus,
      validationUrl,
      qrPayload: validationUrl,
    };
  }

  private async fetchDocumentDetails(
    environment: string,
    credentials: MyInvoisCredentials,
    uuid: string,
  ) {
    const token = await fetchMyInvoisAccessToken(environment, credentials, this.fetchImpl);
    const res = await this.fetchImpl(myInvoisDocumentDetailsUrl(environment, uuid), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(parseApiError(body, `Document details failed (${res.status})`));
    }

    const parsed = parseDocumentDetailsResponse(body);
    return {
      longId: parsed.longId,
      status: mapMyInvoisStatus(parsed.status),
      validationErrors: parsed.validationErrors,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
