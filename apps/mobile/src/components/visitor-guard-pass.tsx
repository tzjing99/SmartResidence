import type {
  VisitorEntryMode,
  VisitorStatus,
  VisitorVisitType,
} from '@smartresidence/shared-types';
import { Button, Card, Pill, palette, radius } from '@smartresidence/ui-mobile';
import { Text, View } from 'react-native';

export type GuardVerifiedVisitor = {
  name: string;
  accessCode?: string | null;
  status?: VisitorStatus | string;
  visitType?: VisitorVisitType | string;
  entryMode?: VisitorEntryMode;
  vehiclePlate?: string | null;
  unit?: { identifier?: string; block?: { name?: string } };
};

export function unitLabel(visitor: GuardVerifiedVisitor) {
  const block = visitor.unit?.block?.name;
  const unit = visitor.unit?.identifier;
  if (block && unit) return `${block} · ${unit}`;
  return unit ?? '—';
}

export function entryModeLabel(mode?: VisitorEntryMode) {
  return mode === 'DRIVE_IN' ? 'Drive in' : mode === 'WALK_IN' ? 'Walk in' : null;
}

export function guardPassSummary(visitor: GuardVerifiedVisitor) {
  const lines = [visitor.name, `Unit: ${unitLabel(visitor)}`, `Code: ${visitor.accessCode ?? '—'}`];
  if (isOwnerPreRegistered(visitor)) {
    lines.push('Pre-registered by resident');
  }
  const mode = entryModeLabel(visitor.entryMode);
  if (mode) lines.push(`Entry: ${mode}`);
  if (visitor.entryMode === 'DRIVE_IN' && visitor.vehiclePlate) {
    lines.push(`Plate: ${visitor.vehiclePlate}`);
  }
  return lines.join('\n');
}

export function isOwnerPreRegistered(visitor: GuardVerifiedVisitor) {
  return visitor.visitType === 'PRE_REG' && visitor.status === 'APPROVED';
}

type VisitorGuardPassCardProps = {
  visitor: GuardVerifiedVisitor;
  onCheckIn?: () => void;
  checkInDisabled?: boolean;
  checkInLabel?: string;
};

export function VisitorGuardPassCard({
  visitor,
  onCheckIn,
  checkInDisabled,
  checkInLabel = 'Check in',
}: VisitorGuardPassCardProps) {
  const mode = entryModeLabel(visitor.entryMode);
  const ownerPreRegistered = isOwnerPreRegistered(visitor);

  return (
    <Card>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{visitor.name}</Text>
      <Text style={{ color: palette.mutedLight, fontSize: 14, marginTop: 4 }}>
        Unit: {unitLabel(visitor)}
      </Text>
      {ownerPreRegistered ? (
        <Text style={{ color: '#047857', fontSize: 13, fontWeight: '700', marginTop: 8 }}>
          Pre-registered by resident — verify and check in.
        </Text>
      ) : null}
      {visitor.accessCode ? (
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: 28,
            fontWeight: '700',
            letterSpacing: 4,
            marginTop: 12,
          }}
        >
          {visitor.accessCode}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {mode ? (
          <View
            style={{
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: palette.borderLight,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600' }}>{mode}</Text>
          </View>
        ) : null}
        {visitor.entryMode === 'DRIVE_IN' && visitor.vehiclePlate ? (
          <Text style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: '700' }}>
            {visitor.vehiclePlate}
          </Text>
        ) : null}
        {ownerPreRegistered ? <Pill tone="success" label="Resident pre-registered" /> : null}
        {visitor.status ? (
          <Pill
            tone={ownerPreRegistered ? 'success' : 'primary'}
            label={
              ownerPreRegistered
                ? 'Ready for check-in'
                : visitor.status.toLowerCase().replace(/_/g, ' ')
            }
          />
        ) : null}
      </View>
      {onCheckIn ? (
        <View style={{ marginTop: 16 }}>
          <Button title={checkInLabel} onPress={onCheckIn} disabled={checkInDisabled} />
        </View>
      ) : null}
    </Card>
  );
}
