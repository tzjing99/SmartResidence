import { useMyCondos, useSlaSettings, useUpdateSlaSettings } from '@smartresidence/api-client';
import type { ThreadPriority } from '@smartresidence/api-client';
import {
  AlignRow,
  AppText,
  Button,
  Card,
  Field,
  Input,
  MetaLine,
  Pill,
  palette,
} from '@smartresidence/ui-mobile';
import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { api } from '../../src/lib/api';

const PRIORITIES: ThreadPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (24 * 60))}d`;
}

const BAND_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  recommended: 'success',
  acceptable: 'warning',
  risky: 'danger',
};

export default function HelpdeskSettingsScreen() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const settings = useSlaSettings(api, condo?.id ?? null);
  const save = useUpdateSlaSettings(api);

  const [graceDays, setGraceDays] = useState('7');
  const [mins, setMins] = useState<Record<ThreadPriority, string>>({
    URGENT: '240',
    HIGH: '1440',
    NORMAL: '4320',
    LOW: '10080',
  });

  useEffect(() => {
    if (!settings.data) return;
    const map: Record<ThreadPriority, string> = {
      URGENT: '240',
      HIGH: '1440',
      NORMAL: '4320',
      LOW: '10080',
    };
    for (const p of settings.data.policies) {
      map[p.priority] = String(p.resolutionMins);
    }
    setGraceDays(String(settings.data.resolutionConfirmationGraceDays));
    setMins(map);
  }, [settings.data]);

  async function onSave(riskyAcknowledged = false) {
    if (!condo?.id) return;
    try {
      await save.mutateAsync({
        condoId: condo.id,
        policies: PRIORITIES.map((priority) => ({
          priority,
          resolutionMins: Number(mins[priority]),
        })),
        resolutionConfirmationGraceDays: Number(graceDays),
        riskyAcknowledged: riskyAcknowledged || undefined,
      });
      Alert.alert('Saved', 'SLA settings updated');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('risky')) {
        Alert.alert('Risky SLA', 'Settings exceed advisory norms. Proceed anyway?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', onPress: () => onSave(true) },
        ]);
      } else {
        Alert.alert('Error', msg);
      }
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <MetaLine parts={[condo?.name ?? 'Condo', `${settings.data?.unitCount ?? '—'} units`]} />

      <Card>
        <Field label="Grace period (days)">
          <Input
            value={graceDays}
            onChangeText={setGraceDays}
            keyboardType="number-pad"
            editable={settings.data?.editable ?? false}
          />
        </Field>
      </Card>

      {PRIORITIES.map((priority) => {
        const item = settings.data?.policies.find((p) => p.priority === priority);
        const band = item?.band ?? 'recommended';
        return (
          <Card key={priority}>
            <AlignRow style={{ justifyContent: 'space-between' }}>
              <AppText variant="label">{priority}</AppText>
              <Pill tone={BAND_TONE[band] ?? 'neutral'} label={band} />
            </AlignRow>
            <MetaLine
              parts={[
                `Resolution: ${formatMins(Number(mins[priority]))}`,
                `First response: ${formatMins(Math.round(Number(mins[priority]) * 0.4))}`,
              ]}
              style={{ marginTop: 4 }}
            />
            <Field containerStyle={{ marginTop: 8 }}>
              <Input
                value={mins[priority]}
                onChangeText={(v) => setMins((prev) => ({ ...prev, [priority]: v }))}
                keyboardType="number-pad"
                editable={settings.data?.editable ?? false}
              />
            </Field>
          </Card>
        );
      })}

      {settings.data?.editable ? (
        <Button title={save.isPending ? 'Saving…' : 'Save SLA settings'} onPress={() => onSave()} />
      ) : (
        <AppText variant="meta" style={{ textAlign: 'center' }}>
          Read-only — admin access required to edit.
        </AppText>
      )}
    </ScrollView>
  );
}
