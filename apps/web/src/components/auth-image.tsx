'use client';

import { api } from '@/lib/api';
import { type AttachmentFormat, supportsAvif } from '@smartresidence/api-client';
import { cn } from '@smartresidence/ui-web';
import { ImageOff, Loader2 } from 'lucide-react';
import * as React from 'react';

/**
 * Loads an attachment that requires a bearer token (so a plain <img src> can't
 * be used) by streaming it via the API into an object URL. The object URL is
 * revoked on unmount to avoid leaking memory. The underlying GET response is
 * immutable-cacheable, so the browser still caches the bytes across mounts.
 *
 * Format strategy: feature-detect AVIF once and request that variant; if the
 * fetch or the <img> decode fails, retry the WebP fallback, then show a
 * placeholder. The server also falls back internally (AVIF -> WebP -> original)
 * while a transcode is still PENDING, so the thumbnail is never blank.
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
  // Tracks whether we've already downgraded to WebP for this image.
  const triedWebpRef = React.useRef(false);

  React.useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    triedWebpRef.current = false;

    const load = (format: AttachmentFormat) =>
      api
        .fetchAttachmentBlob(attachmentId, variant, format)
        .then((blob) => {
          if (!active) return;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {
          if (!active) return;
          if (!triedWebpRef.current) {
            triedWebpRef.current = true;
            void load('webp');
          } else {
            setFailed(true);
          }
        });

    void supportsAvif().then((avif) => {
      if (!active) return;
      const format: AttachmentFormat = avif ? 'avif' : 'webp';
      if (format === 'webp') triedWebpRef.current = true;
      void load(format);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, variant]);

  function handleImgError() {
    if (!triedWebpRef.current) {
      triedWebpRef.current = true;
      api
        .fetchAttachmentBlob(attachmentId, variant, 'webp')
        .then((blob) => setUrl(URL.createObjectURL(blob)))
        .catch(() => setFailed(true));
    } else {
      setFailed(true);
    }
  }

  async function openFull() {
    try {
      const avif = await supportsAvif();
      const blob = await api.fetchAttachmentBlob(attachmentId, 'raw', avif ? 'avif' : 'webp');
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
      <img src={url} alt={alt} onError={handleImgError} className="size-full object-cover" />
    </button>
  );
}
