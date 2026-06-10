import { useAckAnnouncement, useAnnouncement } from '@smartresidence/api-client';
import {
  AlignRow,
  AnimatedPressable,
  AppText,
  Button,
  Card,
  Pill,
  palette,
} from '@smartresidence/ui-mobile';
import * as FileSystem from 'expo-file-system/legacy';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Markdown } from '../../../src/components/markdown';
import {
  ResidentScreen,
  RESIDENT_CORAL,
  residentStyles,
} from '../../../src/components/resident-screen';
import { api } from '../../../src/lib/api';
import { getCachedSession } from '../../../src/lib/session';

const IMPORTANCE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  URGENT: 'danger',
  IMPORTANT: 'warning',
  INFO: 'info',
};

export default function AnnouncementDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useAnnouncement(api, id ?? null);
  const ack = useAckAnnouncement(api);
  const a = detail.data;

  const openPdf = useCallback(async (attachmentId: string) => {
    try {
      const session = await getCachedSession();
      const headers: Record<string, string> = {};
      if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
      if (session?.activeCondoId) headers['x-condo-id'] = session.activeCondoId;
      const dest = `${FileSystem.cacheDirectory}announcement-${attachmentId}.pdf`;
      const result = await FileSystem.downloadAsync(api.attachmentRawUrl(attachmentId), dest, {
        headers,
      });
      await Linking.openURL(result.uri);
    } catch (err) {
      Alert.alert('Could not open PDF', (err as Error).message);
    }
  }, []);

  return (
    <ResidentScreen
      eyebrow="Announcement"
      title={a?.title ?? 'Loading…'}
      subtitle={a?.publishedAt ? new Date(a.publishedAt).toLocaleString() : undefined}
      headerAction={
        <AnimatedPressable onPress={() => router.back()}>
          <AppText variant="label" style={{ color: RESIDENT_CORAL }}>
            Back
          </AppText>
        </AnimatedPressable>
      }
    >
      {detail.isLoading || !a ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading…
        </AppText>
      ) : (
        <View style={{ gap: 16 }}>
          <AlignRow gap={8} style={{ flexWrap: 'wrap' }}>
            <Pill tone="neutral" label={a.category.toLowerCase()} />
            <Pill tone={IMPORTANCE_TONE[a.importance] ?? 'info'} label={a.importance.toLowerCase()} />
            {!a.readAt ? <Pill tone="warning" label="Unread" /> : null}
          </AlignRow>
          <Card style={[residentStyles.card, { padding: 16 }]}>
            <Markdown>{a.body}</Markdown>
          </Card>
          {a.attachments
            ?.filter((att) => att.mimeType === 'application/pdf')
            .map((pdf) => (
              <Button
                key={pdf.id}
                title={`Open PDF${pdf.fileName ? ` · ${pdf.fileName}` : ''}`}
                variant="secondary"
                onPress={() => openPdf(pdf.id)}
              />
            ))}
          {a.requiresAck ? (
            <Button
              title="Acknowledge"
              onPress={async () => {
                try {
                  await ack.mutateAsync(a.id);
                  Alert.alert('Acknowledged', 'Thank you for confirming.');
                } catch (err) {
                  Alert.alert('Error', (err as Error).message);
                }
              }}
            />
          ) : null}
        </View>
      )}
    </ResidentScreen>
  );
}
