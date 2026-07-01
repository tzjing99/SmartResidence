import { useCreateDeliveryPass } from '@smartresidence/api-client';
import type { DeliveryPlatform, VisitorPassKind } from '@smartresidence/shared-types';
import {
  DELIVERY_PLATFORM_OPTIONS,
  QUICK_ENTRY_PASS_KIND_OPTIONS,
  defaultExpectedArrival,
  defaultQuickEntryDurationMins,
} from '@smartresidence/shared-types';
import { Button, Card, palette, radius } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { RESIDENT_CARD_BORDER, residentStyles } from './resident-screen';

type QuickPassKind = Exclude<VisitorPassKind, 'STANDARD'>;

const inputStyle = {
  minHeight: 46,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.borderLight,
  backgroundColor: palette.surfaceLight,
  paddingHorizontal: 12,
  fontSize: 14,
};

export function DeliveryPassForm({ unitId }: { unitId?: string }) {
  const router = useRouter();
  const create = useCreateDeliveryPass(api);
  const [open, setOpen] = useState(false);
  const [passKind, setPassKind] = useState<QuickPassKind>('DELIVERY');
  const [platform, setPlatform] = useState<DeliveryPlatform>('GRABFOOD');
  const [name, setName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [expectedAt, setExpectedAt] = useState<Date>(() => defaultExpectedArrival());

  async function onSubmit() {
    if (!unitId) {
      Alert.alert('No unit', 'Link a unit to your account before creating passes.');
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
      Alert.alert('Could not create pass', (err as Error).message);
    }
  }

  const durationMins = defaultQuickEntryDurationMins(passKind);

  return (
    <Card style={[residentStyles.card, { borderColor: 'rgba(245, 158, 11, 0.35)' }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={{ gap: 4 }}>
        <Text style={{ fontWeight: '700', color: palette.textLight, fontSize: 16 }}>
          Delivery / rider pass
        </Text>
        <Text style={{ color: palette.mutedLight, fontSize: 13, lineHeight: 18 }}>
          Quick gate pass for GrabFood, Foodpanda, Grab, and similar — about{' '}
          {Math.round(durationMins / 60)} hours valid.
        </Text>
        <Text
          style={{ color: palette.coralPrimary, fontSize: 13, fontWeight: '600', marginTop: 4 }}
        >
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
            borderTopColor: RESIDENT_CARD_BORDER,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600' }}>Pass type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_ENTRY_PASS_KIND_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setPassKind(opt.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: radius.full,
                  backgroundColor:
                    passKind === opt.value ? 'rgba(255, 56, 92, 0.12)' : palette.surfaceLight,
                  borderWidth: 1,
                  borderColor:
                    passKind === opt.value ? 'rgba(255, 56, 92, 0.25)' : palette.borderLight,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600' }}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600' }}>Platform</Text>
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
                    platform === opt.value ? 'rgba(245, 158, 11, 0.15)' : palette.surfaceLight,
                  borderWidth: 1,
                  borderColor:
                    platform === opt.value ? 'rgba(245, 158, 11, 0.4)' : palette.borderLight,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600' }}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            placeholder="Rider name (optional)"
            value={name}
            onChangeText={setName}
            style={inputStyle}
          />
          <TextInput
            placeholder="Vehicle plate (optional)"
            value={vehiclePlate}
            onChangeText={(v) => setVehiclePlate(v.toUpperCase())}
            style={inputStyle}
            autoCapitalize="characters"
          />
          <TextInput
            value={expectedAt.toISOString().slice(0, 16).replace('T', ' ')}
            onChangeText={(v) => {
              const parsed = new Date(v.replace(' ', 'T'));
              if (!Number.isNaN(parsed.getTime())) setExpectedAt(parsed);
            }}
            style={inputStyle}
            placeholder="Expected arrival (YYYY-MM-DD HH:mm)"
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
