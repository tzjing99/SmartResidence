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
  spacing,
  useTheme,
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
import { useT } from '../../../src/i18n/locale-provider';
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
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const threads = useThreads(api, RESIDENT_THREAD_INBOX_PARAMS);
  const { refreshControl } = usePullToRefresh(useCallback(() => threads.refetch(), [threads]));

  const items = threads.data?.items ?? [];

  return (
    <ResidentScreen
      eyebrow={t('messages.title')}
      title={t('nav.screens.messages')}
      subtitle={t('messages.subtitle')}
      scrollProps={{ refreshControl }}
      headerAction={
        <Button
          title={t('messages.new')}
          onPress={() => router.push('/(resident)/messages/new' as Href)}
        />
      }
    >
      {threads.isLoading && !threads.data ? (
        <AppText variant="meta" style={{ color: colors.muted }}>
          {t('actions.loading')}
        </AppText>
      ) : items.length === 0 ? (
        <EmptyState title={t('messages.empty')} description={t('messages.subtitle')} />
      ) : (
        items.map((thread, index) => (
          <FadeInView key={thread.id} index={index}>
            <AnimatedPressable
              onPress={() => router.push(`/(resident)/messages/${thread.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`${thread.subject}. ${prettyLabel(thread.category)}, ${thread._count?.messages ?? 0} messages, ${prettyLabel(thread.status)}`}
            >
              <Card style={[residentStyles.card, { padding: 16 }]}>
                <AlignRow
                  style={{ alignItems: 'flex-start', minHeight: 0, flexWrap: 'wrap' }}
                  gap={12}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <AppText variant="label" numberOfLines={2}>
                      {thread.subject}
                    </AppText>
                    <MetaLine
                      parts={[
                        prettyLabel(thread.category),
                        `${thread._count?.messages ?? 0} messages`,
                        `updated ${new Date(thread.lastMessageAt).toLocaleDateString()}`,
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
                    <Pill
                      tone={PRIORITY_TONE[thread.priority] ?? 'neutral'}
                      label={prettyLabel(thread.priority)}
                    />
                    <Pill
                      tone={STATUS_TONE[thread.status] ?? 'neutral'}
                      label={prettyLabel(thread.status)}
                    />
                  </View>
                </AlignRow>
                <AppText variant="meta" style={{ color: colors.muted, marginTop: spacing.sm }}>
                  {t('actions.view')}
                </AppText>
              </Card>
            </AnimatedPressable>
          </FadeInView>
        ))
      )}
    </ResidentScreen>
  );
}
