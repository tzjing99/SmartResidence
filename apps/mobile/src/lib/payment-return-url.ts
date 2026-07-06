/** Deep link the app handles after a hosted gateway completes. */
export function paymentDeepLink(extra?: Record<string, string>): string {
  const params = new URLSearchParams({ paid: '1', ...extra });
  return `smartresidence://billing?${params.toString()}`;
}

/**
 * Return URL sent to Fiuu / iPay88 so the gateway POSTs back to our API,
 * which settles the payment and redirects to the app deep link.
 */
export function buildHostedGatewayReturnUrl(
  provider: string,
  deepLink = paymentDeepLink(),
): string {
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
  if (provider === 'RAZER') {
    return `${apiBase}/api/webhooks/payments/fiuu/return?next=${encodeURIComponent(deepLink)}`;
  }
  if (provider === 'IPAY88') {
    return `${apiBase}/api/webhooks/payments/ipay88/return?next=${encodeURIComponent(deepLink)}`;
  }
  if (provider === 'TNG') {
    return `${apiBase}/api/webhooks/payments/tng/return?next=${encodeURIComponent(deepLink)}`;
  }
  return deepLink;
}

export function isPaymentReturnUrl(url: string): boolean {
  if (url.startsWith('smartresidence://')) return true;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.has('paid') || parsed.searchParams.has('advance');
  } catch {
    return url.includes('paid=1') || url.includes('advance=1');
  }
}
