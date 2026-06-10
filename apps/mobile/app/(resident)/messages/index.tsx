import { useThreads } from '@smartresidence/api-client';
import {
  AlignRow,
  AnimatedPressable,
  AppText,
  Button,
  Card,
  EmptyState,
  FadeInView,
  MetaLine,
  Pill,
  palette,
  spacing,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import {
  ResidentScreen,
  prettyLabel,
  residentStyles,
} from '../../../src/components/resident-screen';
import { usePullToRefresh } from '../../../src/components/smart-refresh-control';
import { api } from '../../../src/lib/api';
import { RESIDENT_THREAD_INBOX_PARAMS } from '../../../src/lib/resident-threads';

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
  const threads = useThreads(api, RESIDENT_THREAD_INBOX_PARAMS);
  const { refreshControl } = usePullToRefresh(
    useCallback(() => threads.refetch(), [threads]),
  );

  const items = threads.data?.items ?? [];

  return (
    <ResidentScreen
      eyebrow="Messages"
      title="Ask management"
      subtitle="Keep every request, reply, and resolution in one conversation."
      scrollProps={{ refreshControl }}
      headerAction={
        <Button title="New message" onPress={() => router.push('/(resident)/messages/new' as Href)} />
      }
    >
      {threads.isLoading && !threads.data ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading conversations...
        </AppText>
      ) : items.length === 0 ? (
        <EmptyState title="No conversations yet" description="Start a message when you need help from management." />
      ) : (
        items.map((t, index) => (
          <FadeInView key={t.id} index={index}>
            <AnimatedPressable onPress={() => router.push(`/(resident)/messages/${t.id}` as Href)}>
              <Card style={[residentStyles.card, { padding: 16 }]}>
                <AlignRow style={{ alignItems: 'flex-start', minHeight: 0, flexWrap: 'wrap' }} gap={12}>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <AppText variant="label" numberOfLines={2}>
                      {t.subject}
                    </AppText>
                    <MetaLine
                      parts={[
                        prettyLabel(t.category),
                        `${t._count?.messages ?? 0} messages`,
                        `updated ${new Date(t.lastMessageAt).toLocaleDateString()}`,
                      ]}
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: 6,
                      maxWidth: '100%',
                    }}
                  >
                    <Pill tone={PRIORITY_TONE[t.priority] ?? 'neutral'} label={prettyLabel(t.priority)} />
                    <Pill tone={STATUS_TONE[t.status] ?? 'neutral'} label={prettyLabel(t.status)} />
                  </View>
                </AlignRow>
                <AppText
                  variant="meta"
                  style={{ color: palette.mutedLight, marginTop: spacing.sm }}
                >
                  Tap to view the full thread.
                </AppText>
              </Card>
            </AnimatedPressable>
          </FadeInView>
        ))
      )}
    </ResidentScreen>
  );
}
