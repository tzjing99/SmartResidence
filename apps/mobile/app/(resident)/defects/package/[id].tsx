import { Ionicons } from '@expo/vector-icons';
import {
  queryKeys,
  useBulkUpdateReportItems,
  useDefectReport,
  useTransitionDefect,
} from '@smartresidence/api-client';
import { DEFECT_SIGN_OFF_PROMPT_LABEL, defectReference } from '@smartresidence/shared-types';
import {
  AnimatedPressable,
  AppText,
  Button,
  Card,
  Pill,
  Stack,
  palette,
  spacing,
} from '@smartresidence/ui-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import {
  RESIDENT_CORAL,
  ResidentScreen,
  prettyLabel,
  residentStyles,
} from '../../../../src/components/resident-screen';
import { api } from '../../../../src/lib/api';
import {
  confirmDefectBulkSignOff,
  confirmDefectSignOff,
} from '../../../../src/lib/defect-sign-off';

export default function DefectPackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const report = useDefectReport(api, id ?? null);
  const detail = report.data;
  const qc = useQueryClient();
  const transition = useTransitionDefect(api);
  const bulk = useBulkUpdateReportItems(api);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function signOff(itemId: string, status: 'CLOSED' | 'REOPENED') {
    if (!id) return;
    const run = async () => {
      setPendingIds((prev) => new Set(prev).add(itemId));
      try {
        await transition.mutateAsync({ id: itemId, status });
        qc.invalidateQueries({ queryKey: queryKeys.defectReport(id) });
        Alert.alert(
          status === 'CLOSED' ? 'Signed off' : 'Sent back',
          status === 'CLOSED' ? 'Defect signed off and closed.' : 'Defect sent back for more work.',
        );
      } catch (err) {
        Alert.alert('Could not update', (err as Error).message);
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    };
    if (status === 'CLOSED') {
      confirmDefectSignOff(run);
      return;
    }
    await run();
  }

  function acceptAll() {
    if (!detail || !id) return;
    const ids = detail.items.filter((i) => i.status === 'RESOLVED').map((i) => i.id);
    if (ids.length === 0) return;
    confirmDefectBulkSignOff(ids.length, async () => {
      try {
        const res = await bulk.mutateAsync({ id, data: { defectIds: ids, status: 'CLOSED' } });
        Alert.alert('Signed off', `${res.updated} defect(s) signed off and closed.`);
      } catch (err) {
        Alert.alert('Could not sign off all', (err as Error).message);
      }
    });
  }

  const resolvedCount = detail?.statusCounts.RESOLVED ?? 0;
  const done = resolvedCount + (detail?.statusCounts.CLOSED ?? 0);
  const pct = detail && detail.itemCount > 0 ? Math.round((done / detail.itemCount) * 100) : 0;

  const grouped = (detail?.items ?? []).reduce<Record<string, NonNullable<typeof detail>['items']>>(
    (acc, item) => {
      const key = item.spaceLabel ?? 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {},
  );

  return (
    <ResidentScreen
      eyebrow="Defect report"
      title={detail ? 'Defect Report' : 'Loading…'}
      subtitle={
        detail ? `${defectReference(detail.id)} · ${detail.itemCount} defect(s)` : undefined
      }
      headerAction={
        <AnimatedPressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={palette.navy} />
        </AnimatedPressable>
      }
    >
      {report.isLoading ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          Loading report…
        </AppText>
      ) : !detail ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          This package could not be found.
        </AppText>
      ) : (
        <Stack gap={spacing.md}>
          <Card style={residentStyles.card}>
            <AppText variant="meta" style={{ color: palette.mutedLight }}>
              Raised {new Date(detail.createdAt).toLocaleDateString()}
            </AppText>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <View
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: palette.borderLight,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    borderRadius: 999,
                    backgroundColor: pct === 100 ? '#10B981' : RESIDENT_CORAL,
                  }}
                />
              </View>
              <AppText variant="meta" style={{ color: palette.textLight, fontWeight: '600' }}>
                {done}/{detail.itemCount} fixed
              </AppText>
            </View>

            {resolvedCount > 0 ? (
              <AppText variant="meta" style={{ color: '#047857', marginTop: 10, lineHeight: 18 }}>
                {resolvedCount} defect(s) fixed and waiting for your confirmation — check below and
                tell management if anything needs revisiting.
              </AppText>
            ) : null}
          </Card>

          {resolvedCount > 0 ? (
            <Card
              style={[
                residentStyles.card,
                {
                  borderColor: '#A7F3D0',
                  backgroundColor: '#ECFDF5',
                  gap: spacing.sm,
                },
              ]}
            >
              <AppText style={{ fontWeight: '600', color: '#065F46' }}>
                {resolvedCount} defect(s) are ready for sign-off
              </AppText>
              <Button
                title={bulk.isPending ? 'Signing off…' : `Sign off all (${resolvedCount})`}
                loading={bulk.isPending}
                onPress={acceptAll}
                size="sm"
              />
            </Card>
          ) : null}

          {Object.entries(grouped).map(([room, items]) => (
            <View key={room} style={{ gap: spacing.sm }}>
              <AppText
                variant="meta"
                style={{
                  color: palette.mutedLight,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {room} — {items.length} {items.length === 1 ? 'defect' : 'defects'}
              </AppText>
              {items.map((item) => (
                <Card key={item.id} style={[residentStyles.card, { gap: spacing.sm }]}>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText style={{ fontWeight: '600', color: palette.textLight }}>
                        {item.elementName
                          ? `${item.elementName}${item.issueName ? `: ${item.issueName}` : ''}`
                          : item.title}
                      </AppText>
                      {item.description && item.description !== item.title ? (
                        <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 2 }}>
                          {item.description}
                        </AppText>
                      ) : null}
                    </View>
                    <Pill
                      tone={
                        item.status === 'CLOSED' || item.status === 'RESOLVED'
                          ? 'success'
                          : item.status === 'NEW'
                            ? 'primary'
                            : 'info'
                      }
                      label={
                        item.status === 'RESOLVED' ? 'Waiting sign-off' : prettyLabel(item.status)
                      }
                    />
                  </View>

                  {item.status === 'RESOLVED' ? (
                    <View style={{ gap: spacing.sm }}>
                      <AppText variant="meta" style={{ color: '#047857' }}>
                        Fixed by management — please verify and confirm below.
                      </AppText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <Button
                          title={DEFECT_SIGN_OFF_PROMPT_LABEL}
                          size="sm"
                          loading={pendingIds.has(item.id)}
                          disabled={pendingIds.has(item.id) || bulk.isPending}
                          onPress={() => signOff(item.id, 'CLOSED')}
                          style={{ flexGrow: 1 }}
                        />
                        <Button
                          title="Reject — more work"
                          variant="secondary"
                          size="sm"
                          disabled={pendingIds.has(item.id) || bulk.isPending}
                          onPress={() => signOff(item.id, 'REOPENED')}
                          style={{ flexGrow: 1 }}
                        />
                      </View>
                    </View>
                  ) : null}

                  {item.attachments.length > 0 ? (
                    <AppText variant="meta" style={{ color: palette.mutedLight }}>
                      {item.attachments.length} photo(s) attached
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </View>
          ))}
        </Stack>
      )}
    </ResidentScreen>
  );
}
