import {
  useAckAnnouncement,
  useAnnouncement,
  useMarkAnnouncementRead,
} from '@smartresidence/api-client';
import { ANNOUNCEMENT_CATEGORY_LABELS, isPdfMime } from '@smartresidence/shared-types';
import {
  AlignRow,
  AnimatedPressable,
  AppText,
  Button,
  Card,
  Pill,
  Stack,
  palette,
  spacing,
} from '@smartresidence/ui-mobile';
import { Ionicons } from '@expo/vector-icons';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect } from 'react';
import { Linking, View } from 'react-native';
import { AuthImage } from '../../../src/components/auth-image';
import { Markdown } from '../../../src/components/markdown';
import {
  ResidentScreen,
  residentStyles,
} from '../../../src/components/resident-screen';
import { api } from '../../../src/lib/api';

const CORAL = '#FF385C';

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
  }, [item?.id, item?.readByMe]);

  const openPdf = useCallback(async (attachmentId: string) => {
    const { uri, headers } = await api.attachmentImageSource(attachmentId, 'raw');
    const path = `${FileSystem.cacheDirectory}memo-${attachmentId}.pdf`;
    const downloaded = await FileSystem.downloadAsync(uri, path, { headers });
    await Linking.openURL(downloaded.uri);
  }, []);

  return (
    <ResidentScreen
      eyebrow="Announcement"
      title={item?.title ?? 'Notice'}
      subtitle={item ? ANNOUNCEMENT_CATEGORY_LABELS[item.category] : ''}
      headerAction={
        <AnimatedPressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={palette.navy} />
        </AnimatedPressable>
      }
    >
      {detail.isLoading ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading...
        </AppText>
      ) : !item ? (
        <AppText variant="meta">This notice could not be found.</AppText>
      ) : (
        <Stack gap={spacing.md}>
          <AlignRow gap={8} style={{ flexWrap: 'wrap' }}>
            {item.pinned ? <Pill tone="info" label="pinned" /> : null}
            {item.importance !== 'INFO' ? (
              <Pill
                tone={item.importance === 'URGENT' ? 'danger' : 'warning'}
                label={item.importance.toLowerCase()}
              />
            ) : null}
          </AlignRow>

          <Card style={[residentStyles.card, { padding: 16 }]}>
            <Markdown>{item.body}</Markdown>
          </Card>

          {item.attachments?.map((attachment) =>
            isPdfMime(attachment.mimeType) ? (
              <AnimatedPressable key={attachment.id} onPress={() => openPdf(attachment.id)}>
                <Card style={[residentStyles.card, { padding: 16 }]}>
                  <AlignRow gap={12}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: '#FFF1F0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="document-text-outline" size={22} color={CORAL} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <AppText variant="label">Official memo (PDF)</AppText>
                      <AppText variant="meta" numberOfLines={1} style={{ color: palette.mutedLight }}>
                        {attachment.fileName ?? 'management-memo.pdf'}
                      </AppText>
                      <AppText variant="meta" style={{ color: CORAL, fontWeight: '600' }}>
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

          {item.requiresAck && !item.ackedByMe ? (
            <Button
              title="I acknowledge this notice"
              onPress={() => ack.mutate(item.id)}
            />
          ) : item.requiresAck && item.ackedByMe ? (
            <AppText variant="meta" style={{ color: palette.mutedLight, textAlign: 'center' }}>
              Acknowledged
            </AppText>
          ) : null}

          <AnimatedPressable onPress={() => router.push('/(resident)/announcements' as Href)}>
            <AppText variant="meta" style={{ color: CORAL, textAlign: 'center' }}>
              All announcements
            </AppText>
          </AnimatedPressable>
        </Stack>
      )}
    </ResidentScreen>
  );
}
