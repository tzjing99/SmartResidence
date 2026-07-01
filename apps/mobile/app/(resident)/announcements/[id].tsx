import { Ionicons } from '@expo/vector-icons';
import {
  useAckAnnouncement,
  useAnnouncement,
  useMarkAnnouncementRead,
} from '@smartresidence/api-client';
import { isPdfMime } from '@smartresidence/shared-types';
import {
  AlignRow,
  AnimatedPressable,
  AppText,
  Button,
  Card,
  Stack,
  palette,
  spacing,
} from '@smartresidence/ui-mobile';
import * as FileSystem from 'expo-file-system/legacy';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Linking, View } from 'react-native';
import {
  AnnouncementHeroBadges,
  formatAnnouncementDetailDate,
} from '../../../src/components/announcements-ui';
import { AuthImage } from '../../../src/components/auth-image';
import { Markdown } from '../../../src/components/markdown';
import {
  RESIDENT_CORAL,
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../../src/components/resident-screen';
import { api } from '../../../src/lib/api';

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const detail = useAnnouncement(api, id ?? null);
  const markRead = useMarkAnnouncementRead(api);
  const ack = useAckAnnouncement(api);
  const item = detail.data;

  useEffect(() => {
    if (item && !item.readByMe) {
      markRead.mutate(item.id);
    }
  }, [item, markRead]);

  const openPdf = useCallback(async (attachmentId: string) => {
    const { uri, headers } = await api.attachmentImageSource(attachmentId, 'raw');
    const path = `${FileSystem.cacheDirectory}memo-${attachmentId}.pdf`;
    const downloaded = await FileSystem.downloadAsync(uri, path, { headers });
    await Linking.openURL(downloaded.uri);
  }, []);

  const publishedLabel = item
    ? formatAnnouncementDetailDate(item.publishedAt ?? item.createdAt)
    : null;

  return (
    <ResidentScreen
      eyebrow="Announcement"
      title={item?.title ?? 'Notice'}
      subtitle={item ? [publishedLabel, item.author?.name].filter(Boolean).join(' · ') : undefined}
      headerAction={
        <AnimatedPressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={palette.navy} />
        </AnimatedPressable>
      }
    >
      {detail.isLoading ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading...
        </AppText>
      ) : detail.isError || !item ? (
        <Stack gap={spacing.md}>
          <AppText variant="meta">
            This notice could not be found or is no longer available.
          </AppText>
          <AnimatedPressable onPress={() => router.push('/(resident)/announcements' as Href)}>
            <AlignRow gap={6}>
              <Ionicons name="arrow-back" size={16} color={RESIDENT_CORAL} />
              <AppText variant="meta" style={{ color: RESIDENT_CORAL, fontWeight: '600' }}>
                Back to announcements
              </AppText>
            </AlignRow>
          </AnimatedPressable>
        </Stack>
      ) : (
        <Stack gap={spacing.lg}>
          <AnnouncementHeroBadges item={item} />

          {item.attachments?.length ? (
            <View style={{ gap: spacing.sm }}>
              <ResidentSectionHeader title="Official memo & attachments" />
              {item.attachments.map((attachment) =>
                isPdfMime(attachment.mimeType) ? (
                  <AnimatedPressable key={attachment.id} onPress={() => openPdf(attachment.id)}>
                    <Card style={[residentStyles.card, { padding: 16 }]}>
                      <AlignRow gap={12}>
                        <View style={residentStyles.iconBubble}>
                          <Ionicons name="document-text-outline" size={22} color={RESIDENT_CORAL} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <AppText variant="label">Official memo (PDF)</AppText>
                          <AppText
                            variant="meta"
                            numberOfLines={1}
                            style={{ color: palette.mutedLight }}
                          >
                            {attachment.fileName ?? 'management-memo.pdf'}
                          </AppText>
                          <AppText
                            variant="meta"
                            style={{ color: RESIDENT_CORAL, fontWeight: '600' }}
                          >
                            Tap to view full document
                          </AppText>
                        </View>
                      </AlignRow>
                    </Card>
                  </AnimatedPressable>
                ) : (
                  <View key={attachment.id} style={{ borderRadius: 16, overflow: 'hidden' }}>
                    <AuthImage attachmentId={attachment.id} variant="raw" size={280} />
                  </View>
                ),
              )}
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <ResidentSectionHeader title="Summary" />
            <Card style={[residentStyles.card, { padding: 16 }]}>
              <Markdown>{item.body}</Markdown>
            </Card>
          </View>

          {item.requiresAck && !item.ackedByMe ? (
            <Button
              title="I acknowledge this notice"
              onPress={() => ack.mutate(item.id)}
              loading={ack.isPending}
            />
          ) : item.requiresAck && item.ackedByMe ? (
            <AppText variant="meta" style={{ color: palette.mutedLight, textAlign: 'center' }}>
              You acknowledged this notice.
            </AppText>
          ) : null}

          <AnimatedPressable onPress={() => router.push('/(resident)/announcements' as Href)}>
            <AlignRow gap={6} style={{ justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={16} color={RESIDENT_CORAL} />
              <AppText variant="meta" style={{ color: RESIDENT_CORAL, fontWeight: '600' }}>
                All announcements
              </AppText>
            </AlignRow>
          </AnimatedPressable>
        </Stack>
      )}
    </ResidentScreen>
  );
}
