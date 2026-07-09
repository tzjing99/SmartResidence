import {
  useCreateRecurringPass,
  useDeleteRecurringPass,
  useMyUnits,
  useUnitRecurringPasses,
} from '@smartresidence/api-client';
import type { RecurringPass } from '@smartresidence/shared-types';
import { WEEKDAY_LABELS, formatRecurringScheduleSummary } from '@smartresidence/shared-types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Input,
  Pill,
  radius,
  useTheme,
} from '@smartresidence/ui-mobile';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  useResidentStyles,
} from '../../../src/components/resident-screen';
import { usePullToRefresh } from '../../../src/components/smart-refresh-control';
import { useT } from '../../../src/i18n/locale-provider';
import { api } from '../../../src/lib/api';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function RecurringPassesScreen() {
  const t = useT();
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const unitId = unit?.id ?? null;
  const passes = useUnitRecurringPasses(api, unitId);
  const createPass = useCreateRecurringPass(api);
  const deletePass = useDeleteRecurringPass(api);
  const { refreshControl } = usePullToRefresh(
    useCallback(() => passes.refetch().then(() => undefined), [passes]),
  );

  const [showForm, setShowForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('18:00');
  const [validFrom, setValidFrom] = useState(isoDate());
  const [validUntil, setValidUntil] = useState(isoDate(30));

  const items = (passes.data?.items ?? []) as RecurringPass[];

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function resetForm() {
    setGuestName('');
    setGuestPhone('');
    setVehiclePlate('');
    setDays([1, 2, 3, 4, 5]);
    setStart('08:00');
    setEnd('18:00');
    setValidFrom(isoDate());
    setValidUntil(isoDate(30));
  }

  async function onSubmit() {
    if (!unitId) return;
    if (guestName.trim().length < 2) {
      Alert.alert(
        t('mobile.visitors.guestNameRequired'),
        t('mobile.visitors.guestNameRequiredBody'),
      );
      return;
    }
    if (days.length === 0) {
      Alert.alert(t('mobile.visitors.pickDays'), t('mobile.visitors.pickDaysBody'));
      return;
    }
    try {
      await createPass.mutateAsync({
        unitId,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        schedule: {
          daysOfWeek: [...days].sort((a, b) => a - b),
          timeWindow: { start, end },
        },
        validFrom: new Date(validFrom) as never,
        validUntil: new Date(validUntil) as never,
      });
      resetForm();
      setShowForm(false);
      Alert.alert(t('mobile.visitors.passCreated'), t('mobile.visitors.passCreatedBody'));
    } catch (err) {
      Alert.alert(t('mobile.visitors.couldNotCreatePass'), (err as Error).message);
    }
  }

  function confirmDelete(pass: RecurringPass) {
    Alert.alert(
      t('mobile.visitors.removePassTitle'),
      t('mobile.visitors.removePassBody', { name: pass.guestName }),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: t('upload.remove'),
          style: 'destructive',
          onPress: () => {
            if (!unitId) return;
            void deletePass
              .mutateAsync({ id: pass.id, unitId })
              .catch((err) =>
                Alert.alert(t('mobile.visitors.couldNotRemove'), (err as Error).message),
              );
          },
        },
      ],
    );
  }

  return (
    <ResidentScreen
      eyebrow="Visitors"
      title="Recurring passes"
      subtitle="Give trusted regulars — helpers, tutors, caregivers — repeat access on a set schedule."
      scrollProps={{ refreshControl }}
      headerAction={
        <Button
          title={showForm ? 'Cancel' : 'New recurring pass'}
          size="sm"
          variant={showForm ? 'secondary' : 'primary'}
          onPress={() => setShowForm((v) => !v)}
        />
      }
    >
      {showForm ? (
        <Card style={[styles.card, { gap: 12 }]}>
          <AppText style={{ fontWeight: '700' }}>New recurring pass</AppText>

          <View style={{ gap: 6 }}>
            <AppText variant="label">Guest name</AppText>
            <Input
              value={guestName}
              onChangeText={setGuestName}
              placeholder="e.g. Cleaner — Siti"
            />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, gap: 6 }}>
              <AppText variant="label">Phone (optional)</AppText>
              <Input
                value={guestPhone}
                onChangeText={setGuestPhone}
                placeholder="01X-XXX XXXX"
                keyboardType="phone-pad"
              />
            </View>
            <View style={{ flex: 1, minWidth: 140, gap: 6 }}>
              <AppText variant="label">Vehicle plate (optional)</AppText>
              <Input value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="ABC 1234" />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <AppText variant="label">Days of week</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {WEEKDAYS.map((d) => {
                const active = days.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggleDay(d)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: radius.full,
                      backgroundColor: active ? colors.coralSoft : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? `${colors.coral}40` : colors.border,
                    }}
                  >
                    <AppText
                      style={{
                        fontWeight: '600',
                        color: active ? colors.coral : colors.fg,
                      }}
                    >
                      {WEEKDAY_LABELS[d]}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 120, gap: 6 }}>
              <AppText variant="label">From (time)</AppText>
              <Input value={start} onChangeText={setStart} placeholder="08:00" />
            </View>
            <View style={{ flex: 1, minWidth: 120, gap: 6 }}>
              <AppText variant="label">Until (time)</AppText>
              <Input value={end} onChangeText={setEnd} placeholder="18:00" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 140, gap: 6 }}>
              <AppText variant="label">Valid from</AppText>
              <Input value={validFrom} onChangeText={setValidFrom} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1, minWidth: 140, gap: 6 }}>
              <AppText variant="label">Valid until</AppText>
              <Input value={validUntil} onChangeText={setValidUntil} placeholder="YYYY-MM-DD" />
            </View>
          </View>

          <Button title="Create pass" onPress={onSubmit} loading={createPass.isPending} />
        </Card>
      ) : null}

      <ResidentSectionHeader
        title="Active recurring passes"
        subtitle="Guards can admit these guests during the scheduled windows."
      />

      {passes.isLoading ? (
        <Card style={styles.card}>
          <AppText variant="meta" muted>
            Loading recurring passes…
          </AppText>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          title="No recurring passes yet"
          description="Create a pass for a regular guest so they don't need a new invite each visit."
        />
      ) : (
        items.map((pass) => (
          <Card key={pass.id} style={[styles.card, { gap: 8 }]}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <AppText style={{ fontWeight: '700' }} numberOfLines={2}>
                  {pass.guestName}
                </AppText>
                <AppText variant="meta" muted>
                  {formatRecurringScheduleSummary(pass.schedule)}
                </AppText>
                <AppText variant="meta" muted>
                  {new Date(pass.validFrom).toLocaleDateString()} –{' '}
                  {new Date(pass.validUntil).toLocaleDateString()}
                  {pass.vehiclePlate ? ` · ${pass.vehiclePlate}` : ''}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <Pill
                  tone={pass.active ? 'success' : 'neutral'}
                  label={pass.active ? 'Active' : 'Off'}
                />
              </View>
            </View>
            {pass.accessCode ? (
              <AppText
                style={{ fontSize: 18, fontWeight: '700', letterSpacing: 2, color: colors.fg }}
              >
                {pass.accessCode}
              </AppText>
            ) : null}
            <Button
              title="Remove pass"
              size="sm"
              variant="ghost"
              onPress={() => confirmDelete(pass)}
            />
          </Card>
        ))
      )}
    </ResidentScreen>
  );
}
