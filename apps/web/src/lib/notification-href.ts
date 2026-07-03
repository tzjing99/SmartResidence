/**
 * Map a notification to an in-app web route, if one applies. Shared between the
 * realtime toast (`realtime-provider.tsx`) and the notification bell dropdown so
 * both navigate consistently.
 */
export function webHrefForNotification(payload: {
  kind?: string | null;
  data?: Record<string, unknown> | null;
}): string | null {
  const data = payload.data ?? {};
  const deeplink = typeof data.deeplink === 'string' ? data.deeplink : null;
  if (deeplink?.startsWith('smartresidence://')) {
    // Strip *all* leading slashes, not just the scheme separator — otherwise
    // a payload like `smartresidence:////evil.com` yields `path = "//evil.com"`
    // and `router.push('///evil.com')`, which browsers can treat as a
    // protocol-relative redirect off our own domain (open redirect).
    const path = deeplink.slice('smartresidence://'.length).replace(/^\/+/, '');
    if (!path) return null;
    return `/${path}`;
  }
  if (typeof data.invoiceId === 'string') return `/billing/${data.invoiceId}`;
  if (typeof data.announcementId === 'string') return `/announcements/${data.announcementId}`;
  if (typeof data.visitorId === 'string') return '/visitors';
  if (typeof data.submissionId === 'string') return '/forms';
  if (typeof data.sosId === 'string') return '/admin/safety';
  if (typeof data.patrolCheckpointId === 'string') return '/admin/patrol';
  if (typeof data.parcelId === 'string') {
    if (deeplink?.includes('admin/parcels')) return '/admin/parcels';
    return '/parcels';
  }
  if (payload.kind === 'PARCEL_RECEIVED' || payload.kind === 'PARCEL_OVERDUE') return '/parcels';
  if (typeof data.lostFoundPostId === 'string') {
    if (deeplink?.includes('admin/lost-found')) return '/admin/lost-found';
    return '/lost-found';
  }
  if (payload.kind === 'LOST_FOUND_POST') return '/admin/lost-found';
  if (payload.kind === 'AUDIT_ALERT') return '/who-viewed';
  return null;
}
