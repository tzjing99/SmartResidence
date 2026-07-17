import { useCreateDeliveryPass } from '@smartresidence/api-client';
import type { DeliveryPlatform, VisitorPassKind } from '@smartresidence/shared-types';
import {
  DELIVERY_PLATFORM_OPTIONS,
  QUICK_ENTRY_PASS_KIND_OPTIONS,
  defaultExpectedArrival,
  defaultQuickEntryDurationMins,
} from '@smartresidence/shared-types';
import { Button, Card, radius, useTheme } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useT } from '../i18n/locale-provider';
import { alertResidentMutationError } from '../lib/access-restriction-error';
import { api } from '../lib/api';
import { useResidentStyles } from './resident-screen';

type QuickPassKind = Exclude<VisitorPassKind, 'STANDARD'>;

export function DeliveryPassForm({ unitId }: { unitId?: string }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const fieldStyle = useMemo(
    () => ({
      minHeight: 46,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.fg,
    }),
    [colors],
  );
  const create = useCreateDeliveryPass(api);
  const [open, setOpen] = useState(false);
  const [passKind, setPassKind] = useState<QuickPassKind>('DELIVERY');
  const [platform, setPlatform] = useState<DeliveryPlatform>('GRABFOOD');
  const [name, setName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [expectedAt, setExpectedAt] = useState<Date>(() => defaultExpectedArrival());

  async function onSubmit() {
    if (!unitId) {
      Alert.alert(t('visitors.delivery.noUnitTitle'), t('visitors.delivery.noUnitBody'));
      return;
    }
    try {
      const created = await create.mutateAsync({
        unitId,
        passKind,
        platform,
        name: name.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        expectedAt,
      });
      setOpen(false);
      setName('');
      setVehiclePlate('');
      router.push(`/(resident)/visitors/${created.id}` as Href);
    } catch (err) {
      alertResidentMutationError(err, {
        title: t('visitors.delivery.createFailedTitle'),
        arrearsTitle: t('billing.accessRestrictedTitle'),
        arrearsBody: t('billing.accessRestrictedBody'),
        payLabel: t('billing.accessRestrictedPay'),
        dismissLabel: t('billing.accessRestrictedDismiss'),
        onPay: () => router.push('/(resident)/billing' as Href),
      });
    }
  }

  const durationMins = defaultQuickEntryDurationMins(passKind);

  return (
    <Card style={[styles.card, { borderColor: 'rgba(245, 158, 11, 0.35)' }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={{ gap: 4 }}>
        <Text style={{ fontWeight: '700', color: colors.fg, fontSize: 16 }}>
          Delivery / rider pass
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
          Quick gate pass for GrabFood, Foodpanda, Grab, and similar — about{' '}
          {Math.round(durationMins / 60)} hours valid.
        </Text>
        <Text style={{ color: colors.coral, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
          {open ? 'Hide form' : 'Tap to create'}
        </Text>
      </Pressable>

      {open ? (
        <View
          style={{
            gap: 12,
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.fg }}>Pass type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_ENTRY_PASS_KIND_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setPassKind(opt.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: radius.full,
                  backgroundColor: passKind === opt.value ? colors.coralSoft : colors.surface,
                  borderWidth: 1,
                  borderColor: passKind === opt.value ? `${colors.coral}40` : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: passKind === opt.value ? colors.coral : colors.fg,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.fg }}>Platform</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DELIVERY_PLATFORM_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setPlatform(opt.value)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radius.full,
                  backgroundColor:
                    platform === opt.value ? 'rgba(245, 158, 11, 0.15)' : colors.surface,
                  borderWidth: 1,
                  borderColor: platform === opt.value ? 'rgba(245, 158, 11, 0.4)' : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: platform === opt.value ? '#D97706' : colors.fg,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            placeholder="Rider name (optional)"
            value={name}
            onChangeText={setName}
            style={fieldStyle}
            placeholderTextColor={colors.muted}
          />
          <TextInput
            placeholder="Vehicle plate (optional)"
            value={vehiclePlate}
            onChangeText={(v) => setVehiclePlate(v.toUpperCase())}
            style={fieldStyle}
            autoCapitalize="characters"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            value={expectedAt.toISOString().slice(0, 16).replace('T', ' ')}
            onChangeText={(v) => {
              const parsed = new Date(v.replace(' ', 'T'));
              if (!Number.isNaN(parsed.getTime())) setExpectedAt(parsed);
            }}
            style={fieldStyle}
            placeholder="Expected arrival (YYYY-MM-DD HH:mm)"
            placeholderTextColor={colors.muted}
          />

          <Button
            title="Create delivery pass"
            loading={create.isPending}
            onPress={() => void onSubmit()}
          />
        </View>
      ) : null}
    </Card>
  );
}
