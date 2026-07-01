import { Ionicons } from '@expo/vector-icons';
import {
  useAcknowledgeSos,
  useCondoSosAlerts,
  useMyCondos,
  useResolveSos,
} from '@smartresidence/api-client';
import {
  type SosAlert,
  SOS_KIND_LABELS,
  SOS_STATUS_LABELS,
  isSosOpen,
} from '@smartresidence/shared-types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Pill,
  palette,
  radius,
  spacing,
} from '@smartresidence/ui-mobile';
import { ActivityIndicator, Alert, View, StyleSheet } from 'react-native';
import {
  GUARD_CORAL,
  GUARD_SOFT_CORAL,
  GuardScreen,
  guardStyles,
} from '../../src/components/guard-screen';
import { api } from '../../src/lib/api';

const KIND_ICONS: Record<SosAlert['kind'], keyof typeof Ionicons.glyphMap> = {
  GENERAL: 'alert-circle-outline',
  MEDICAL: 'medkit-outline',
  SECURITY: 'shield-outline',
  FIRE: 'flame-outline',
};

function formatWhen(value: Date | string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AlertsScreen() {
  const condos = useMyCondos(api);
  const condoId = condos.data?.[0]?.id ?? null;
  const sos = useCondoSosAlerts(api, condoId);
  const acknowledge = useAcknowledgeSos(api);
  const resolve = useResolveSos(api);

  const active = sos.data?.active ?? [];
  const recent = (sos.data?.recent ?? []).filter((a) => !isSosOpen(a.status)).slice(0, 8);

  function confirmResolve(id: string) {
    Alert.alert('Resolve this alert?', 'Mark the emergency as handled and closed.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: () =>
          resolve.mutate(
            { id },
            { onError: (err) => Alert.alert('Could not resolve', (err as Error).message) },
          ),
      },
    ]);
  }

  function renderAlert(alert: SosAlert, isActive: boolean) {
    return (
      <Card
        key={alert.id}
        style={[guardStyles.card, styles.alertCard, isActive ? styles.alertCardActive : null]}
      >
        <View style={styles.alertTopRow}>
          <View style={styles.alertIcon}>
            <Ionicons name={KIND_ICONS[alert.kind]} size={22} color={GUARD_CORAL} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText numberOfLines={1} style={styles.alertKind}>
              {SOS_KIND_LABELS[alert.kind]} emergency
            </AppText>
            <AppText variant="meta" numberOfLines={1} style={styles.alertMeta}>
              {alert.raisedBy?.name ?? 'Resident'}
              {alert.unit ? ` · Unit ${alert.unit.identifier}` : ''}
            </AppText>
          </View>
          <Pill
            tone={alert.status === 'ACTIVE' ? 'danger' : isActive ? 'warning' : 'neutral'}
            label={SOS_STATUS_LABELS[alert.status]}
          />
        </View>

        <AppText variant="meta" style={styles.alertTime}>
          Raised {formatWhen(alert.createdAt)}
        </AppText>

        {alert.locationNote ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color={GUARD_CORAL} />
            <AppText style={styles.locationText}>{alert.locationNote}</AppText>
          </View>
        ) : null}

        {alert.acknowledgedBy ? (
          <AppText variant="meta" style={styles.alertMeta}>
            Acknowledged by {alert.acknowledgedBy.name}
            {alert.acknowledgedAt ? ` · ${formatWhen(alert.acknowledgedAt)}` : ''}
          </AppText>
        ) : null}

        {isActive ? (
          <View style={styles.actionRow}>
            {alert.status === 'ACTIVE' ? (
              <Button
                title="Acknowledge"
                size="sm"
                variant="soft-primary"
                loading={acknowledge.isPending}
                style={styles.actionButton}
                onPress={() =>
                  acknowledge.mutate(alert.id, {
                    onError: (err) => Alert.alert('Could not acknowledge', (err as Error).message),
                  })
                }
              />
            ) : null}
            <Button
              title="Resolve"
              size="sm"
              variant="primary"
              loading={resolve.isPending}
              style={styles.actionButton}
              onPress={() => confirmResolve(alert.id)}
            />
          </View>
        ) : (
          <AppText variant="meta" style={styles.alertMeta}>
            {alert.status === 'RESOLVED' && alert.resolvedAt
              ? `Resolved ${formatWhen(alert.resolvedAt)}${
                  alert.resolvedBy ? ` by ${alert.resolvedBy.name}` : ''
                }`
              : 'Closed'}
          </AppText>
        )}
      </Card>
    );
  }

  return (
    <GuardScreen
      eyebrow="Guard alerts"
      title="Emergency SOS"
      subtitle="Resident panic alerts for this property. Acknowledge to confirm you are responding, then resolve once handled."
      headerAction={
        <Pill
          tone={active.length > 0 ? 'danger' : 'success'}
          label={active.length > 0 ? `${active.length} active` : 'All clear'}
        />
      }
    >
      {sos.isLoading ? (
        <Card style={[guardStyles.card, styles.stateCard]}>
          <ActivityIndicator color={GUARD_CORAL} />
          <AppText variant="meta" style={styles.stateCopy}>
            Loading alerts…
          </AppText>
        </Card>
      ) : sos.isError ? (
        <Card style={[guardStyles.card, styles.stateCard]}>
          <Ionicons name="cloud-offline-outline" size={22} color={palette.mutedLight} />
          <AppText style={styles.stateTitle}>Could not load alerts</AppText>
          <Button title="Retry" variant="secondary" onPress={() => void sos.refetch()} />
        </Card>
      ) : active.length === 0 ? (
        <EmptyState
          title="No active alerts"
          description="Resident emergency alerts appear here the moment they are raised. This screen refreshes automatically."
        />
      ) : (
        <View style={{ gap: spacing.sm }}>{active.map((a) => renderAlert(a, true))}</View>
      )}

      {recent.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <AppText variant="subheading" style={styles.sectionTitle}>
              Recently closed
            </AppText>
          </View>
          <View style={{ gap: spacing.sm }}>{recent.map((a) => renderAlert(a, false))}</View>
        </>
      ) : null}
    </GuardScreen>
  );
}

const styles = StyleSheet.create({
  stateCard: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  stateTitle: {
    color: palette.textLight,
    fontSize: 16,
    fontWeight: '800',
  },
  stateCopy: {
    color: palette.mutedLight,
    lineHeight: 20,
  },
  alertCard: {
    gap: spacing.sm,
  },
  alertCardActive: {
    borderColor: 'rgba(220,38,38,0.35)',
    backgroundColor: '#FFF5F5',
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertKind: {
    color: palette.textLight,
    fontSize: 17,
    fontWeight: '800',
  },
  alertMeta: {
    color: palette.mutedLight,
    lineHeight: 19,
  },
  alertTime: {
    color: palette.mutedLight,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  locationText: {
    flex: 1,
    color: palette.textLight,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 132,
  },
  sectionHeader: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: palette.textLight,
  },
});
