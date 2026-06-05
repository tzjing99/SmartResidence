import { useMyUnits, useUnitVisitors, useVisitorQr } from '@smartresidence/api-client';
import type { Visitor } from '@smartresidence/shared-types';
import { Button, Card, EmptyState, Pill, palette, radius } from '@smartresidence/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../../src/lib/api';
import { shareVisitorPass } from '../../../src/lib/visitor-pass-share';
import { useTabletLayout } from '../../../src/lib/use-tablet-layout';

type QrSvgRef = { toDataURL: (callback: (data: string) => void) => void };

export default function VisitorPassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; identifier: string } | undefined;
  const visitors = useUnitVisitors(api, unit?.id ?? null);
  const qr = useVisitorQr(api, id ?? null);
  const qrRef = useRef<QrSvgRef | null>(null);
  const [sharing, setSharing] = useState(false);

  const visitor = (visitors.data?.items as Visitor[] | undefined)?.find((v) => v.id === id);
  const qrPayload = qr.data?.qrPayload ?? visitor?.qrPayload ?? visitor?.qrCode ?? '';
  const canShare =
    visitor?.status === 'APPROVED' &&
    visitor.visitType === 'PRE_REG' &&
    Boolean(visitor.accessCode);

  async function onShare() {
    if (!visitor?.accessCode) return;
    setSharing(true);
    try {
      await shareVisitorPass(
        {
          visitorName: visitor.name,
          accessCode: visitor.accessCode,
          expectedAt: new Date(visitor.expectedAt),
          expiresAt: visitor.expiresAt ? new Date(visitor.expiresAt) : null,
          unitIdentifier: unit?.identifier,
        },
        qrRef.current,
      );
    } catch (err) {
      if ((err as Error).message !== 'User did not share') {
        Alert.alert('Could not share', (err as Error).message);
      }
    } finally {
      setSharing(false);
    }
  }

  async function onCopyCode() {
    if (!visitor?.accessCode) return;
    await Share.share({ message: visitor.accessCode });
  }

  if (!visitor && !visitors.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bgLight, padding: horizontalPadding }}>
        <EmptyState title="Pass not found" description="This visitor pass may have been removed." />
        <Button title="Back to visitors" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
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
          <Text style={{ fontSize: 14, color: palette.mutedLight }}>← Back to visitors</Text>
        </Pressable>

        {!visitor ? (
          <ActivityIndicator color={palette.coralPrimary} />
        ) : (
          <>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '700' }}>{visitor.name}</Text>
              <Text style={{ color: palette.mutedLight, fontSize: 14, marginTop: 4 }}>
                Expected {new Date(visitor.expectedAt).toLocaleString()}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Pill
                  tone={visitor.status === 'APPROVED' ? 'primary' : 'neutral'}
                  label={visitor.status.toLowerCase().replace(/_/g, ' ')}
                />
              </View>
            </View>

            {visitor.status === 'PENDING_MANAGEMENT_APPROVAL' ? (
              <Card>
                <Text style={{ fontSize: 14, color: palette.textLight }}>
                  {visitor.urgentOvernight
                    ? 'Urgent overnight — visit the management office before your guest arrives.'
                    : 'Submitted for management approval. You will receive the access code once approved.'}
                </Text>
              </Card>
            ) : null}

            {visitor.pendingManagementReview && visitor.status === 'APPROVED' ? (
              <Card>
                <Text style={{ fontSize: 14, color: palette.textLight }}>
                  Auto-approved for tonight. Management will review this overnight stay on the next
                  working day.
                </Text>
              </Card>
            ) : null}

            {visitor.accessCode ? (
              <Card>
                <Text
                  style={{
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: palette.mutedLight,
                    textAlign: 'center',
                  }}
                >
                  Access code
                </Text>
                <Text
                  style={{
                    fontSize: 36,
                    fontWeight: '700',
                    letterSpacing: 8,
                    textAlign: 'center',
                    marginTop: 8,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {visitor.accessCode}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: palette.mutedLight,
                    textAlign: 'center',
                    marginTop: 8,
                  }}
                >
                  {visitor.overnight
                    ? 'Active from expected arrival. Show this code or QR at the guardhouse.'
                    : 'Show this code or QR at the guardhouse.'}
                </Text>
              </Card>
            ) : null}

            {qr.isLoading ? (
              <ActivityIndicator color={palette.coralPrimary} />
            ) : qrPayload ? (
              <Card>
                <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                  <View
                    style={{
                      borderRadius: radius.md,
                      padding: 12,
                      backgroundColor: '#fff',
                    }}
                  >
                    <QRCode
                      value={qrPayload}
                      size={220}
                      getRef={(ref) => {
                        qrRef.current = ref as QrSvgRef | null;
                      }}
                    />
                  </View>
                  <Text style={{ fontSize: 12, color: palette.mutedLight }}>Scan at the guardhouse</Text>
                </View>
              </Card>
            ) : null}

            {canShare ? (
              <View style={{ gap: 12, marginTop: 4 }}>
                <Button
                  title={sharing ? 'Sharing…' : 'Share pass'}
                  size="lg"
                  loading={sharing}
                  onPress={onShare}
                />
                <Pressable onPress={onCopyCode} style={{ alignSelf: 'center' }}>
                  <Text style={{ fontSize: 14, color: palette.coralPrimary, fontWeight: '600' }}>
                    Copy code only
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
