import { useMarkNotificationsRead, useNotifications } from '@smartresidence/api-client';
import {
  AnimatedPressable,
  AppText,
  Button,
  Card,
  EmptyState,
  FadeInView,
  SkeletonList,
  useTheme,
} from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import {
  RESIDENT_CORAL,
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';
import { hapticLight } from '../../src/lib/haptics';
import { resolveNotificationRoute } from '../../src/lib/push-navigation';

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const notifications = useNotifications(api, { limit: 30 });
  const markRead = useMarkNotificationsRead(api);
  const { refreshControl } = usePullToRefresh(
    useCallback(() => notifications.refetch().then(() => undefined), [notifications]),
  );

  const items = (notifications.data?.items as NotificationRow[] | undefined) ?? [];
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);

  function handlePress(row: NotificationRow) {
    hapticLight();
    if (!row.readAt) void markRead.mutateAsync([row.id]).catch(() => undefined);
    const route = resolveNotificationRoute(row.data);
    if (route) router.push(route as Href);
  }

  function handleMarkAll() {
    if (unreadIds.length === 0) return;
    void markRead.mutateAsync(unreadIds).catch(() => undefined);
  }

  return (
    <ResidentScreen
      eyebrow="Notifications"
      title="Notification center"
      subtitle="Everything that needs your attention, gathered in one place."
      scrollProps={{ refreshControl }}
      headerAction={
        unreadIds.length > 0 ? (
          <Button
            title={`Mark all read (${unreadIds.length})`}
            size="sm"
            variant="secondary"
            onPress={handleMarkAll}
            disabled={markRead.isPending}
          />
        ) : undefined
      }
    >
      <ResidentSectionHeader
        title="Recent"
        subtitle="Tap a notification to open it and mark it read."
      />

      {notifications.isLoading ? (
        <SkeletonList rows={4} rowHeight={72} />
      ) : items.length === 0 ? (
        <EmptyState
          title="You're all caught up."
          description="New alerts about your unit, visitors, fees, and messages appear here."
        />
      ) : (
        items.map((row, index) => {
          const unread = !row.readAt;
          return (
            <FadeInView key={row.id} index={index}>
              <AnimatedPressable
                onPress={() => handlePress(row)}
                accessibilityRole="button"
                accessibilityLabel={`${row.title}${unread ? ', unread' : ''}. ${row.body ?? prettyLabel(row.kind)}`}
              >
                <Card
                  style={[
                    residentStyles.card,
                    unread ? { borderColor: 'rgba(255, 56, 92, 0.35)' } : null,
                  ]}
                >
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        marginTop: 6,
                        backgroundColor: unread ? RESIDENT_CORAL : 'transparent',
                      }}
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <AppText
                        style={{
                          fontWeight: unread ? '800' : '700',
                          color: colors.fg,
                        }}
                        numberOfLines={2}
                      >
                        {row.title}
                      </AppText>
                      {row.body ? (
                        <AppText variant="bodySm" style={{ color: colors.muted }} numberOfLines={3}>
                          {row.body}
                        </AppText>
                      ) : null}
                      <AppText variant="meta" style={{ color: colors.muted }}>
                        {prettyLabel(row.kind)}
                        {' · '}
                        {new Date(row.createdAt).toLocaleString()}
                      </AppText>
                    </View>
                  </View>
                </Card>
              </AnimatedPressable>
            </FadeInView>
          );
        })
      )}
    </ResidentScreen>
  );
}
