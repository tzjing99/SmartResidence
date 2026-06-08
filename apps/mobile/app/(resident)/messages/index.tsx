import { useThreads } from '@smartresidence/api-client';
import {
  AlignRow,
  AnimatedPressable,
  AppText,
  Button,
  Card,
  FadeInView,
  MetaLine,
  Pill,
  palette,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { api } from '../../../src/lib/api';

const PRIORITY_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  URGENT: 'danger',
  HIGH: 'warning',
  NORMAL: 'info',
  LOW: 'success',
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  OPEN: 'info',
  AWAITING_MANAGEMENT: 'warning',
  AWAITING_RESIDENT: 'neutral',
  PENDING_RESIDENT_CONFIRMATION: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REOPENED: 'warning',
};

export default function MessagesScreen() {
  const router = useRouter();
  const threads = useThreads(api, { limit: 50 });

  const items = threads.data?.items ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <AppText variant="title">Messages</AppText>
      <Button title="New message" onPress={() => router.push('/(resident)/messages/new' as Href)} />
      {items.length === 0 ? (
        <AppText variant="meta">No conversations yet.</AppText>
      ) : (
        items.map((t, index) => (
          <FadeInView key={t.id} index={index}>
            <AnimatedPressable onPress={() => router.push(`/(resident)/messages/${t.id}` as Href)}>
              <Card style={{ padding: 16 }}>
                <AlignRow style={{ alignItems: 'flex-start', minHeight: 0 }} gap={12}>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <AppText variant="label" numberOfLines={1}>
                      {t.subject}
                    </AppText>
                    <MetaLine
                      parts={[
                        t.category,
                        `${t._count?.messages ?? 0} messages`,
                        `updated ${new Date(t.lastMessageAt).toLocaleDateString()}`,
                      ]}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pill tone={PRIORITY_TONE[t.priority] ?? 'neutral'} label={t.priority} />
                    <Pill tone={STATUS_TONE[t.status] ?? 'neutral'} label={t.status} />
                  </View>
                </AlignRow>
              </Card>
            </AnimatedPressable>
          </FadeInView>
        ))
      )}
    </ScrollView>
  );
}
