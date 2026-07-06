import type { Visitor, VisitorListView } from '@smartresidence/shared-types';
import {
  canOwnerCancelVisitor,
  deliveryPlatformLabel,
  isQuickEntryPass,
  passKindLabel,
  visitorStatusLabel,
  visitorStatusPillTone,
} from '@smartresidence/shared-types';
import { Button, Card, Pill, radius, spacing, useTheme } from '@smartresidence/ui-mobile';
import { Pressable, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useResidentStyles } from './resident-screen';

const QR_BG = '#FFFFFF';

export type VisitorPassCardProps = {
  visitor: Visitor;
  tab: VisitorListView;
  onPress?: () => void;
  pressable?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onInviteAgain?: () => void;
};

function metaLine(visitor: Visitor, tab: VisitorListView): string {
  if (tab === 'live') return 'On site now';
  if (tab === 'history' && visitor.status === 'CHECKED_OUT') return 'Visited';
  return new Date(visitor.expectedAt).toLocaleString();
}

export function VisitorPassCard({
  visitor,
  tab,
  onPress,
  pressable = false,
  onApprove,
  onReject,
  onCancel,
  onInviteAgain,
}: VisitorPassCardProps) {
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const showPass =
    tab === 'upcoming' && Boolean(visitor.accessCode || visitor.qrPayload || visitor.qrCode);
  const showViewPassHint =
    tab === 'upcoming' && visitor.visitType === 'PRE_REG' && visitor.status === 'APPROVED';
  const showPendingActions = visitor.status === 'PENDING_OWNER_APPROVAL';
  const showCancel = tab === 'upcoming' && canOwnerCancelVisitor(visitor);
  const showInviteAgain =
    tab === 'history' &&
    (visitor.status === 'CHECKED_OUT' || visitor.visitType === 'PRE_REG') &&
    Boolean(onInviteAgain);
  const hasFooter = showPendingActions || showCancel || showInviteAgain;

  const card = (
    <Card style={styles.card}>
      <View style={{ gap: spacing.sm }}>
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
            <Text style={{ fontWeight: '700', color: colors.fg, fontSize: 16 }} numberOfLines={2}>
              {visitor.name}
            </Text>
            {isQuickEntryPass(visitor) ? (
              <Pill
                tone="warning"
                label={
                  visitor.deliveryPlatform
                    ? deliveryPlatformLabel(visitor.deliveryPlatform)
                    : passKindLabel(visitor.passKind ?? 'DELIVERY')
                }
              />
            ) : null}
          </View>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}
          >
            <Pill
              tone={visitorStatusPillTone(visitor.status)}
              label={visitorStatusLabel(visitor.status)}
            />
            {visitor.urgentOvernight ? <Pill tone="warning" label="Urgent" /> : null}
          </View>
        </View>

        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
          {metaLine(visitor, tab)}
        </Text>

        {/* Access code + QR side by side */}
        {showPass ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              marginTop: spacing.xxs,
              padding: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {visitor.accessCode ? (
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: colors.muted,
                    fontWeight: '600',
                  }}
                >
                  Access code
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    letterSpacing: 3,
                    marginTop: 4,
                    color: colors.fg,
                    fontVariant: ['tabular-nums'],
                  }}
                  numberOfLines={1}
                >
                  {visitor.accessCode}
                </Text>
              </View>
            ) : null}
            {visitor.qrPayload || visitor.qrCode ? (
              <View
                style={{
                  borderRadius: radius.md,
                  padding: 6,
                  backgroundColor: QR_BG,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <QRCode value={visitor.qrPayload ?? visitor.qrCode ?? ''} size={72} />
              </View>
            ) : null}
          </View>
        ) : null}

        {showViewPassHint ? (
          <Text style={{ fontSize: 13, color: colors.coral, fontWeight: '600' }}>View pass →</Text>
        ) : null}

        {/* Footer actions */}
        {hasFooter ? (
          <View
            style={{
              marginTop: spacing.xs,
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: spacing.sm,
            }}
          >
            {showPendingActions ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Approve" size="sm" style={{ flex: 1 }} onPress={onApprove} />
                <Button
                  title="Reject"
                  size="sm"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={onReject}
                />
              </View>
            ) : null}
            {showCancel ? (
              <Button title="Cancel pass" size="sm" variant="secondary" onPress={onCancel} />
            ) : null}
            {showInviteAgain ? (
              <Button title="Invite again" size="sm" variant="soft-sky" onPress={onInviteAgain} />
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );

  if (!pressable || !onPress) return card;

  return (
    <Pressable onPress={onPress} disabled={!pressable}>
      {card}
    </Pressable>
  );
}
