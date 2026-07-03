import type { ThemeColors } from '@smartresidence/ui-mobile';
import { AppText, Pill, radius, spacing } from '@smartresidence/ui-mobile';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export type SharePassCardProps = {
  visitorName: string;
  accessCode: string;
  qrPayload: string;
  unitIdentifier?: string | null;
  passTypeLabel: string;
  validityLabel: string;
  colors: ThemeColors;
  /** Fixed width for consistent PNG capture (default 320). */
  width?: number;
};

export function SharePassCard({
  visitorName,
  accessCode,
  qrPayload,
  unitIdentifier,
  passTypeLabel,
  validityLabel,
  colors,
  width = 320,
}: SharePassCardProps) {
  return (
    <View
      collapsable={false}
      style={{
        width,
        backgroundColor: colors.card,
        borderRadius: radius['2xl'],
        borderWidth: 1,
        borderColor: colors.cardBorder,
        overflow: 'hidden',
      }}
    >
      <View style={{ height: 4, backgroundColor: colors.coral }} />

      <View style={{ padding: spacing.lg, gap: spacing.md, alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: spacing.xxs, width: '100%' }}>
          {unitIdentifier?.trim() ? (
            <AppText
              style={{
                fontSize: 12,
                fontWeight: '600',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: colors.muted,
              }}
            >
              Unit {unitIdentifier.trim()}
            </AppText>
          ) : null}
          <AppText
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: colors.fg,
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {visitorName}
          </AppText>
          <Pill tone="primary" label={passTypeLabel} />
        </View>

        <View
          style={{
            borderRadius: radius.lg,
            padding: spacing.sm,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <QRCode value={qrPayload} size={168} backgroundColor="#FFFFFF" color="#111827" />
        </View>

        <View style={{ alignItems: 'center', gap: spacing.xxs, width: '100%' }}>
          <AppText
            style={{
              fontSize: 11,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: colors.muted,
              fontWeight: '600',
            }}
          >
            Access code
          </AppText>
          <AppText
            style={{
              fontSize: 34,
              fontWeight: '700',
              letterSpacing: 10,
              color: colors.fg,
              fontVariant: ['tabular-nums'],
            }}
          >
            {accessCode}
          </AppText>
        </View>

        <AppText
          style={{
            fontSize: 12,
            color: colors.muted,
            textAlign: 'center',
            lineHeight: 18,
          }}
        >
          Valid {validityLabel}
        </AppText>

        <AppText
          style={{
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: colors.muted,
            opacity: 0.7,
            marginTop: spacing.xxs,
          }}
        >
          SmartResidence
        </AppText>
      </View>
    </View>
  );
}

export function formatSharePassValidity(expectedAt: Date, expiresAt?: Date | null): string {
  const start = expectedAt.toLocaleString();
  if (expiresAt) {
    return `${start} – ${expiresAt.toLocaleString()}`;
  }
  return `from ${start}`;
}
