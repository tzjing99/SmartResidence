import { Logger } from '@nestjs/common';
import { myInvoisTokenUrl } from './myinvois-api.config';
import type { MyInvoisCredentials } from './myinvois-provider.interface';
import { parseApiError } from './myinvois-response.parser';

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

const cache = new Map<string, CachedToken>();
const logger = new Logger('MyInvoisOAuthClient');

/** Clear in-memory token cache (for tests). */
export function clearMyInvoisTokenCache(): void {
  cache.clear();
}

export type FetchFn = typeof fetch;

/**
 * Obtain a Bearer access token via OAuth2 client credentials.
 * Tokens are cached in-memory until shortly before expiry.
 */
export async function fetchMyInvoisAccessToken(
  environment: string,
  credentials: MyInvoisCredentials,
  fetchImpl: FetchFn = fetch,
): Promise<string> {
  const clientId = credentials.clientId?.trim();
  const clientSecret = credentials.clientSecret?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('MyInvois API client id and secret are required');
  }

  const cacheKey = `${environment}:${clientId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now() + 30_000) {
    return cached.accessToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'InvoicingAPI',
  });

  const res = await fetchImpl(myInvoisTokenUrl(environment), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = parseApiError(json, `OAuth token request failed (${res.status})`);
    logger.warn(`MyInvois OAuth failed (${environment}): ${msg}`);
    throw new Error(msg);
  }

  const accessToken =
    json &&
    typeof json === 'object' &&
    typeof (json as Record<string, unknown>).access_token === 'string'
      ? ((json as Record<string, unknown>).access_token as string)
      : null;
  if (!accessToken) {
    throw new Error('MyInvois OAuth response missing access_token');
  }

  const expiresIn =
    json &&
    typeof json === 'object' &&
    typeof (json as Record<string, unknown>).expires_in === 'number'
      ? ((json as Record<string, unknown>).expires_in as number)
      : 3600;

  cache.set(cacheKey, {
    accessToken,
    expiresAtMs: Date.now() + expiresIn * 1000,
  });

  return accessToken;
}
