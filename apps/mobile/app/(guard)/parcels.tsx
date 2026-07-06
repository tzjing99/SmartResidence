import { Ionicons } from '@expo/vector-icons';
import {
  useCollectParcel,
  useCondoParcels,
  useCreateParcel,
  useMyCondos,
} from '@smartresidence/api-client';
import type { Parcel, ParcelStatus } from '@smartresidence/shared-types';
import { PARCEL_STATUS_LABELS } from '@smartresidence/shared-types';
import {
  AppText,
  Button,
  Card,
  Pill,
  type ThemeColors,
  radius,
  spacing,
  useTheme,
} from '@smartresidence/ui-mobile';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';
import { GuardScreen, GuardSectionHeader } from '../../src/components/guard-screen';
import { type UnitSearchItem, UnitSearchPicker } from '../../src/components/unit-search-picker';
import { api } from '../../src/lib/api';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

const STATUS_TONE: Record<ParcelStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  RECEIVED: 'neutral',
  NOTIFIED: 'warning',
  COLLECTED: 'success',
  OVERDUE: 'danger',
};

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function unitLabel(p: Parcel) {
  const block = p.unit?.block?.name;
  const id = p.unit?.identifier;
  if (block && id) return `${block} · ${id}`;
  return id ?? '—';
}

export default function GuardParcelsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { twoColumn } = useTabletLayout();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const parcels = useCondoParcels(api, condo?.id ?? null, { pendingOnly: true });
  const createParcel = useCreateParcel(api);
  const collectParcel = useCollectParcel(api);

  const [showForm, setShowForm] = useState(false);
  const [unit, setUnit] = useState<UnitSearchItem | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingRef, setTrackingRef] = useState('');
  const [notes, setNotes] = useState('');

  async function submit() {
    if (!condo?.id || !unit?.id || !recipientName.trim()) {
      Alert.alert('Missing fields', 'Select a unit and enter the recipient name.');
      return;
    }
    try {
      await createParcel.mutateAsync({
        condoId: condo.id,
        unitId: unit.id,
        recipientName: recipientName.trim(),
        carrier: carrier.trim() || undefined,
        trackingRef: trackingRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Parcel logged', 'The resident has been notified.');
      setShowForm(false);
      setUnit(null);
      setRecipientName('');
      setCarrier('');
      setTrackingRef('');
      setNotes('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not log parcel');
    }
  }

  function confirmCollect(id: string) {
    Alert.alert('Mark collected', 'Confirm the resident picked up this parcel?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Collected',
        onPress: () => {
          void collectParcel
            .mutateAsync({ id })
            .catch((err) =>
              Alert.alert('Error', err instanceof Error ? err.message : 'Update failed'),
            );
        },
      },
    ]);
  }

  return (
    <GuardScreen
      eyebrow="Gate"
      title="Parcels"
      subtitle="Log lobby deliveries"
      headerAction={
        <Button
          variant="ghost"
          size="sm"
          title={showForm ? 'Cancel' : 'New'}
          onPress={() => setShowForm((v) => !v)}
        />
      }
    >
      <View style={[styles.layout, twoColumn && styles.layoutTablet]}>
        <View style={styles.column}>
          {showForm ? (
            <Card style={[styles.card, styles.formCard]}>
              <UnitSearchPicker value={unit} onChange={setUnit} condoId={condo?.id} />
              <TextInput
                style={styles.input}
                placeholder="Recipient name"
                placeholderTextColor={colors.muted}
                value={recipientName}
                onChangeText={setRecipientName}
              />
              <TextInput
                style={styles.input}
                placeholder="Carrier (optional)"
                placeholderTextColor={colors.muted}
                value={carrier}
                onChangeText={setCarrier}
              />
              <TextInput
                style={styles.input}
                placeholder="Tracking ref (optional)"
                placeholderTextColor={colors.muted}
                value={trackingRef}
                onChangeText={setTrackingRef}
              />
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.muted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
              <Button
                title={createParcel.isPending ? 'Saving…' : 'Save & notify resident'}
                onPress={() => void submit()}
                disabled={createParcel.isPending}
              />
            </Card>
          ) : (
            <Card style={[styles.card, styles.hintCard]}>
              <AppText variant="bodySm" style={{ color: colors.muted }}>
                Tap New to log a courier drop-off. The unit resident gets a push notification
                instantly.
              </AppText>
            </Card>
          )}
        </View>

        <View style={styles.column}>
          <GuardSectionHeader title="Awaiting collection" />
          {parcels.isLoading ? (
            <ActivityIndicator color={colors.coral} style={styles.loader} />
          ) : (parcels.data?.items.length ?? 0) === 0 ? (
            <Card style={[styles.card, styles.emptyCard]}>
              <Ionicons name="cube-outline" size={28} color={colors.muted} />
              <AppText variant="bodySm" style={{ color: colors.muted, textAlign: 'center' }}>
                No pending parcels
              </AppText>
            </Card>
          ) : (
            parcels.data?.items.map((p) => (
              <Card key={p.id} style={[styles.card, styles.parcelCard]}>
                <View style={styles.parcelHeader}>
                  <AppText variant="label">{p.recipientName}</AppText>
                  <Pill tone={STATUS_TONE[p.status]} label={PARCEL_STATUS_LABELS[p.status]} />
                </View>
                <AppText variant="meta" style={{ color: colors.muted }}>
                  {unitLabel(p)}
                  {p.carrier ? ` · ${p.carrier}` : ''}
                </AppText>
                <AppText variant="meta" style={{ color: colors.muted }}>
                  Received {fmtDateTime(p.receivedAt)}
                </AppText>
                <Button
                  variant="secondary"
                  size="sm"
                  title="Mark collected"
                  onPress={() => confirmCollect(p.id)}
                  style={styles.collectBtn}
                />
              </Card>
            ))
          )}
        </View>
      </View>
    </GuardScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    input: {
      minHeight: 48,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.fg,
    },
    layout: { gap: spacing.lg },
    layoutTablet: { flexDirection: 'row', alignItems: 'flex-start' },
    column: { flex: 1, gap: spacing.md },
    formCard: { gap: spacing.sm, padding: spacing.md },
    hintCard: { padding: spacing.md },
    notesInput: { minHeight: 72, textAlignVertical: 'top' },
    loader: { marginTop: spacing.lg },
    emptyCard: {
      alignItems: 'center',
      padding: spacing.xl,
      gap: spacing.sm,
    },
    parcelCard: { padding: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
    parcelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    collectBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  });
}
