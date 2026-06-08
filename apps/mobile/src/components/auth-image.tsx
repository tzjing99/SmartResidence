import { palette, radius } from '@smartresidence/ui-mobile';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '../lib/api';

/**
 * Renders an attachment that requires an auth header. Resolves the streaming
 * URL + bearer header once, then hands it to expo-image, which streams the
 * bytes and caches them on disk (lazy delivery — full image only on demand).
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

  useEffect(() => {
    let active = true;
    api
      .attachmentImageSource(attachmentId, variant)
      .then((s) => active && setSource(s))
      .catch(() => undefined);
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

  if (!source) return <View style={style} />;
  return <Image source={source} style={style} contentFit="cover" transition={150} />;
}
