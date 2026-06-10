import { palette, radius } from '@smartresidence/ui-mobile';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '../lib/api';

/**
 * Renders an attachment that requires an auth header. Resolves the streaming
 * URL + bearer header once, then hands it to expo-image, which streams the
 * bytes and caches them on disk (lazy delivery — full image only on demand).
 *
 * Requests the AVIF variant (expo-image bundles AVIF decoders on iOS + Android,
 * so it renders regardless of OS version). `onError` swaps to the WebP fallback
 * as insurance, and a final failure shows the grey placeholder.
 */
export function AuthImage({
  attachmentId,
  size = 84,
  variant = 'thumb',
}: {
  attachmentId: string;
  size?: number;
  variant?: 'thumb' | 'raw';
}) {
  const [source, setSource] = useState<{ uri: string; headers: Record<string, string> } | null>(
    null,
  );
  const [fallbackUri, setFallbackUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSource(null);
    setFallbackUri(null);
    setFailed(false);
    api
      .attachmentImageSourceBest(attachmentId, variant)
      .then((best) => {
        if (!active) return;
        setSource(best.source);
        setFallbackUri(best.fallbackUri);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [attachmentId, variant]);

  const style = {
    width: size,
    height: size,
    borderRadius: radius.md,
    backgroundColor: palette.borderLight,
  };

  function handleError() {
    // Swap AVIF -> WebP fallback once; give up after that.
    if (fallbackUri && source && source.uri !== fallbackUri) {
      setSource({ uri: fallbackUri, headers: source.headers });
    } else {
      setFailed(true);
    }
  }

  if (failed || !source) return <View style={style} />;
  return (
    <Image
      source={source}
      style={style}
      contentFit="cover"
      transition={150}
      onError={handleError}
    />
  );
}
