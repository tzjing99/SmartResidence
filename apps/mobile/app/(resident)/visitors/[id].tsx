import { useMyUnits, useUnitVisitors, useVisitorQr } from '@smartresidence/api-client';
import type { Visitor } from '@smartresidence/shared-types';
import { visitorStatusLabel, visitorStatusPillTone } from '@smartresidence/shared-types';
import {
  Button,
  Card,
  EmptyState,
  Pill,
  Skeleton,
  SkeletonList,
  radius,
  spacing,
  useTheme,
} from '@smartresidence/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SharePassSheet } from '../../../src/components/share-pass-sheet';
import { api } from '../../../src/lib/api';
import { useTabletLayout } from '../../../src/lib/use-tablet-layout';

const QR_BG = '#FFFFFF';

export default function VisitorPassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null);
  const qr = useVisitorQr(api, id ?? null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  const visitor = (visitors.data?.items as Visitor[] | undefined)?.find((v) => v.id === id);
  const qrPayload = qr.data?.qrPayload ?? visitor?.qrPayload ?? visitor?.qrCode ?? '';
  const canShare =
    visitor?.status === 'APPROVED' &&
    visitor.visitType === 'PRE_REG' &&
    Boolean(visitor.accessCode) &&
    Boolean(qrPayload);

  const shareInput = useMemo(() => {
    if (!visitor?.accessCode) return null;
    return {
      visitorName: visitor.name,
      accessCode: visitor.accessCode,
      expectedAt: new Date(visitor.expectedAt),
      expiresAt: visitor.expiresAt ? new Date(visitor.expiresAt) : null,
      unitIdentifier: unit?.identifier,
    };
  }, [unit?.identifier, visitor]);

  if (!visitor && !visitors.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: horizontalPadding }}>
        <EmptyState title="Pass not found" description="This visitor pass may have been removed." />
        <Button title="Back to visitors" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingVertical: 20,
          paddingBottom: 40,
          alignItems: 'center',
          gap: 16,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: contentMaxWidth,
            paddingHorizontal: horizontalPadding,
            gap: 16,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Text style={{ fontSize: 14, color: colors.muted }}>← Back to visitors</Text>
          </Pressable>

          {!visitor ? (
            <SkeletonList rows={3} rowHeight={70} />
          ) : (
            <>
              {/* Header: name + status pill */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: colors.fg }}>
                    {visitor.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>
                    Expected {new Date(visitor.expectedAt).toLocaleString()}
                  </Text>
                </View>
                <Pill
                  tone={visitorStatusPillTone(visitor.status)}
                  label={visitorStatusLabel(visitor.status)}
                />
              </View>

              {visitor.status === 'PENDING_MANAGEMENT_APPROVAL' ? (
                <Card>
                  <Text style={{ fontSize: 14, color: colors.fg, lineHeight: 20 }}>
                    {visitor.urgentOvernight
                      ? 'Urgent overnight — visit the management office before your guest arrives.'
                      : 'Submitted for management approval. You will receive the access code once approved.'}
                  </Text>
                </Card>
              ) : null}

              {visitor.pendingManagementReview && visitor.status === 'APPROVED' ? (
                <Card>
                  <Text style={{ fontSize: 14, color: colors.fg, lineHeight: 20 }}>
                    Auto-approved for tonight. Management will review this overnight stay on the
                    next working day.
                  </Text>
                </Card>
              ) : null}

              {/* Access code + QR in one card */}
              {visitor.accessCode || qrPayload ? (
                <Card>
                  {qr.isLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                      <Skeleton width={200} height={200} radius={radius.md} />
                    </View>
                  ) : (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.lg,
                        paddingVertical: spacing.xs,
                      }}
                    >
                      {visitor.accessCode ? (
                        <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                          <Text
                            style={{
                              fontSize: 11,
                              letterSpacing: 2,
                              textTransform: 'uppercase',
                              color: colors.muted,
                              fontWeight: '600',
                            }}
                          >
                            Access code
                          </Text>
                          <Text
                            style={{
                              fontSize: 32,
                              fontWeight: '700',
                              letterSpacing: 6,
                              marginTop: spacing.xs,
                              fontVariant: ['tabular-nums'],
                              color: colors.fg,
                            }}
                          >
                            {visitor.accessCode}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: colors.muted,
                              textAlign: 'center',
                              marginTop: spacing.xs,
                              lineHeight: 18,
                            }}
                          >
                            {visitor.overnight
                              ? 'Active from expected arrival.'
                              : 'Show at the guardhouse.'}
                          </Text>
                        </View>
                      ) : null}
                      {qrPayload ? (
                        <View style={{ alignItems: 'center', gap: spacing.xs }}>
                          <View
                            style={{
                              borderRadius: radius.md,
                              padding: spacing.sm,
                              backgroundColor: QR_BG,
                            }}
                          >
                            <QRCode value={qrPayload} size={160} />
                          </View>
                          <Text style={{ fontSize: 12, color: colors.muted }}>Scan at gate</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </Card>
              ) : null}

              {canShare && shareInput ? (
                <Button title="Share pass" size="lg" onPress={() => setShareSheetVisible(true)} />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {shareInput && qrPayload ? (
        <SharePassSheet
          visible={shareSheetVisible}
          onClose={() => setShareSheetVisible(false)}
          input={shareInput}
          qrPayload={qrPayload}
          passKind={visitor?.passKind}
        />
      ) : null}
    </>
  );
}
