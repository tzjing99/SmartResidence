import { useMyUnits, useUnitAccessRestrictionStatus } from '@smartresidence/api-client';
import { Button, palette, radius } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useT } from '../i18n/locale-provider';
import { api } from '../lib/api';

/** Proactive pay-to-unlock notice when the resident unit is soft-blocked. */
export function ArrearsAccessBanner() {
  const t = useT();
  const router = useRouter();
  const units = useMyUnits(api);
  const unitId = (units.data?.[0] as { id?: string } | undefined)?.id ?? null;
  const status = useUnitAccessRestrictionStatus(api, unitId);

  const data = status.data;
  if (!data?.restricted) return null;

  const anyBlocked =
    data.blocked.facility ||
    data.blocked.visitors ||
    data.blocked.deliveryPasses ||
    data.blocked.recurringPasses;
  if (!anyBlocked) return null;

  return (
    <View
      accessibilityRole="text"
      style={{
        borderWidth: 1,
        borderColor: '#D97706',
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        borderRadius: radius.lg,
        padding: 14,
        gap: 10,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: palette.textLight }}>
        {t('billing.accessRestrictedTitle')}
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 18, color: palette.mutedLight }}>
        {t('billing.accessRestrictedBannerBody')}
      </Text>
      <Button
        title={t('billing.accessRestrictedPay')}
        onPress={() => router.push('/(resident)/billing' as Href)}
      />
    </View>
  );
}
