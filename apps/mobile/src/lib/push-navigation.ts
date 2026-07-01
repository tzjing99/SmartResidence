/**
 * Maps a push notification `data` payload to an in-app expo-router path.
 *
 * Push payloads carry a `deeplink` like `smartresidence://visitors/<id>` and/or
 * raw id fields (`visitorId`, `invoiceId`, `defectId`, `announcementId`). We map
 * these to the resident route tree, falling back to the closest list screen when
 * a dedicated detail route does not exist (e.g. billing and defect reports).
 */
const SCHEME = 'smartresidence://';

type NotificationData = Record<string, unknown> | null | undefined;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function routeFromDeeplink(deeplink: string): string | null {
  const path = deeplink.slice(SCHEME.length).replace(/^\/+/, '');
  if (!path) return null;
  const segments = path.split('/').filter(Boolean);
  const [category, ...rest] = segments;

  switch (category) {
    case 'visitors': {
      const id = rest[0];
      return id ? `/(resident)/visitors/${id}` : '/(resident)/visitors';
    }
    case 'billing':
      // No resident invoice detail route; land on the billing screen.
      return '/(resident)/billing';
    case 'defects': {
      // `defects/reports/<id>` has no resident detail route -> defects list.
      if (rest[0] === 'reports') return '/(resident)/defects';
      const id = rest[0];
      return id ? `/(resident)/defects/${id}` : '/(resident)/defects';
    }
    case 'announcements': {
      const id = rest[0];
      return id ? `/(resident)/announcements/${id}` : '/(resident)/announcements';
    }
    case 'sos':
      return '/(resident)/sos';
    case 'parcels':
      return '/(resident)/parcels';
    case 'lost-found':
      return '/(resident)/lost-found';
    case 'forms':
      return '/(resident)/forms';
    default:
      return null;
  }
}

export function resolveNotificationRoute(data: NotificationData): string | null {
  if (!data) return null;

  const deeplink = asString(data.deeplink);
  if (deeplink?.startsWith(SCHEME)) {
    const route = routeFromDeeplink(deeplink);
    if (route) return route;
  }

  const visitorId = asString(data.visitorId);
  if (visitorId) return `/(resident)/visitors/${visitorId}`;

  const defectId = asString(data.defectId);
  if (defectId) return `/(resident)/defects/${defectId}`;

  const announcementId = asString(data.announcementId);
  if (announcementId) return `/(resident)/announcements/${announcementId}`;

  const invoiceId = asString(data.invoiceId);
  if (invoiceId) return '/(resident)/billing';

  const sosId = asString(data.sosId);
  if (sosId) return '/(resident)/sos';

  const parcelId = asString(data.parcelId);
  if (parcelId) return '/(resident)/parcels';

  const lostFoundPostId = asString(data.lostFoundPostId);
  if (lostFoundPostId) return '/(resident)/lost-found';

  const submissionId = asString(data.submissionId);
  if (submissionId) return '/(resident)/forms';

  return null;
}
