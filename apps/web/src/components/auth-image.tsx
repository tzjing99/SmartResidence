'use client';

import { api } from '@/lib/api';
import { cn } from '@smartresidence/ui-web';
import { ImageOff, Loader2 } from 'lucide-react';
import * as React from 'react';

/**
 * Loads an attachment that requires a bearer token (so a plain <img src> can't
 * be used) by streaming it via the API into an object URL. The object URL is
 * revoked on unmount to avoid leaking memory. The underlying GET response is
 * immutable-cacheable, so the browser still caches the bytes across mounts.
 */
export function AuthImage({
  attachmentId,
  variant = 'thumb',
  alt = '',
  className,
}: {
  attachmentId: string;
  variant?: 'thumb' | 'raw';
  alt?: string;
  className?: string;
}) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    api
      .fetchAttachmentBlob(attachmentId, variant)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, variant]);

  async function openFull() {
    try {
      const blob = await api.fetchAttachmentBlob(attachmentId, 'raw');
      const full = URL.createObjectURL(blob);
      window.open(full, '_blank', 'noopener');
      // Give the new tab time to load before revoking.
      setTimeout(() => URL.revokeObjectURL(full), 60_000);
    } catch {
      /* ignore */
    }
  }

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-stone-100 text-stone-400 dark:bg-stone-800',
          className,
        )}
      >
        <ImageOff className="size-5" />
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-stone-100 text-stone-400 dark:bg-stone-800',
          className,
        )}
      >
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <button type="button" onClick={openFull} className={cn('block overflow-hidden', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="size-full object-cover" />
    </button>
  );
}
