import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCreateVisitor,
  useMyCondos,
  useMyUnits,
  useOvernightPreview,
} from '@smartresidence/api-client';
import {
  type CreateVisitorInput,
  CreateVisitorSchema,
  PHONE_COUNTRY_CODES,
  VISITOR_PURPOSE_OPTIONS,
  type VisitorEntryMode,
  type VisitorPurpose,
  defaultExpectedArrival,
} from '@smartresidence/shared-types';
import { Button, Card, palette, radius } from '@smartresidence/ui-mobile';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert, Image, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { useTabletLayout } from '../lib/use-tablet-layout';

async function uploadPlatePhoto(uri: string): Promise<string> {
  const presign = await api.presignAttachment({
    contentType: 'image/jpeg',
    fileName: 'plate.jpg',
  });
  const blob = await fetch(uri).then((r) => r.blob());
  const res = await fetch(presign.url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/jpeg' },
  });
  if (!res.ok) throw new Error('Failed to upload plate photo');
  return presign.key;
}

export type PreRegPrefill = {
  name?: string;
  phone?: string;
  phoneCountryCode?: string;
  vehiclePlate?: string;
  entryMode?: VisitorEntryMode;
};

type PreRegFormProps = {
  prefill?: PreRegPrefill;
  onSuccess?: (visitorId: string) => void;
};

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: palette.textLight }}>{title}</Text>
      {description ? (
        <Text style={{ fontSize: 12, color: palette.mutedLight }}>{description}</Text>
      ) : null}
    </View>
  );
}

export function PreRegForm({ prefill, onSuccess }: PreRegFormProps) {
  const { contentMaxWidth, horizontalPadding, twoColumn } = useTabletLayout();
  const units = useMyUnits(api);
  const condos = useMyCondos(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const condoId = (condos.data?.[0] as { id: string } | undefined)?.id ?? null;
  const create = useCreateVisitor(api);
  const [platePhotoUri, setPlatePhotoUri] = useState<string | null>(null);
  const [platePhotoKey, setPlatePhotoKey] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const form = useForm<CreateVisitorInput>({
    resolver: zodResolver(CreateVisitorSchema),
    defaultValues: {
      unitId: unit?.id ?? '',
      entryMode: prefill?.entryMode ?? 'DRIVE_IN',
      phoneCountryCode: prefill?.phoneCountryCode ?? '+60',
      purpose: 'VISITOR',
      overnight: false,
      expectedAt: defaultExpectedArrival(),
      name: prefill?.name ?? '',
      phone: prefill?.phone ?? '',
      vehiclePlate: prefill?.vehiclePlate ?? '',
    },
  });

  const entryMode = useWatch({ control: form.control, name: 'entryMode' });
  const overnight = useWatch({ control: form.control, name: 'overnight' });
  const expectedAt = useWatch({ control: form.control, name: 'expectedAt' });

  const preview = useOvernightPreview(
    api,
    condoId,
    expectedAt instanceof Date && !Number.isNaN(expectedAt.getTime()) ? expectedAt : null,
    Boolean(overnight),
  );

  useEffect(() => {
    if (unit?.id) form.setValue('unitId', unit.id);
  }, [unit?.id, form]);

  useEffect(() => {
    if (overnight) form.setValue('entryMode', 'DRIVE_IN');
  }, [overnight, form]);

  async function capturePlatePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Camera permission needed', 'Capture the vehicle plate for overnight visits.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    setPlatePhotoUri(uri);
    setUploadingPhoto(true);
    try {
      const key = await uploadPlatePhoto(uri);
      setPlatePhotoKey(key);
    } catch (err) {
      setPlatePhotoKey(null);
      Alert.alert('Upload failed', (err as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  const slotsBlocked = Boolean(overnight && preview.data?.slotsFull);
  const showUrgentReason = Boolean(overnight && preview.data?.isUrgent);

  async function onSubmit(values: CreateVisitorInput) {
    if (!unit) return;
    if (slotsBlocked) {
      Alert.alert('No slots', 'No overnight slots left tonight — contact management.');
      return;
    }
    if (values.overnight && !platePhotoKey) {
      Alert.alert('Plate photo required', 'Capture a photo that matches the typed plate number.');
      return;
    }
    try {
      const created = await create.mutateAsync({
        ...values,
        unitId: unit.id,
        entryMode: values.overnight ? 'DRIVE_IN' : values.entryMode,
        vehiclePlatePhotoUrl: values.overnight ? (platePhotoKey ?? undefined) : undefined,
      });
      if (created.status === 'PENDING_MANAGEMENT_APPROVAL') {
        Alert.alert('Submitted', 'Management will review this overnight visit.');
      } else {
        Alert.alert('Pass created', 'Your visitor can enter with the new access code.');
      }
      onSuccess?.(created.id);
    } catch (err) {
      Alert.alert('Could not create pass', (err as Error).message);
    }
  }

  const fieldGap = twoColumn ? { flex: 1, minWidth: '45%' as const } : undefined;

  return (
    <View
      style={{
        width: '100%',
        maxWidth: contentMaxWidth,
        alignSelf: 'center',
        paddingHorizontal: horizontalPadding,
        gap: 24,
      }}
    >
      <Text style={{ fontSize: 14, color: palette.mutedLight }}>
        Default is drive-in with plate. Overnight stays apply only to pre-registration.
      </Text>

      <View style={{ gap: 12 }}>
        <SectionTitle title="How are they arriving?" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {(
            [
              { id: 'DRIVE_IN' as const, label: 'Drive in' },
              { id: 'WALK_IN' as const, label: 'Walk in' },
            ] as const
          ).map((mode) => {
            const active = entryMode === mode.id;
            return (
              <Pressable
                key={mode.id}
                onPress={() => form.setValue('entryMode', mode.id)}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: active ? palette.coralPrimary : palette.borderLight,
                  backgroundColor: active ? 'rgba(255, 90, 95, 0.08)' : '#fff',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontWeight: '700',
                    color: active ? palette.coralPrimary : palette.textLight,
                  }}
                >
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <SectionTitle title="Guest details" description="Name and contact for the gate pass." />
        <View style={{ flexDirection: twoColumn ? 'row' : 'column', flexWrap: 'wrap', gap: 12 }}>
          <View style={fieldGap ?? { gap: 6 }}>
            <Text style={fieldLabelStyle}>Visitor name</Text>
            <TextInput
              value={form.watch('name')}
              onChangeText={(v) => form.setValue('name', v)}
              style={inputStyle}
              placeholder="Full name"
            />
          </View>

          <View style={[{ gap: 8 }, fieldGap]}>
            <Text style={fieldLabelStyle}>Phone</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              {PHONE_COUNTRY_CODES.map((code) => {
                const active = form.watch('phoneCountryCode') === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => form.setValue('phoneCountryCode', code)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: radius.full,
                      borderWidth: 1,
                      borderColor: active ? palette.coralPrimary : palette.borderLight,
                      backgroundColor: active ? 'rgba(255, 90, 95, 0.08)' : '#fff',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: active ? palette.coralPrimary : palette.mutedLight,
                      }}
                    >
                      {code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={form.watch('phone') ?? ''}
              onChangeText={(v) => form.setValue('phone', v, { shouldValidate: true })}
              style={inputStyle}
              keyboardType="phone-pad"
              placeholder="Local number"
            />
            {form.formState.errors.phone ? (
              <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>
                {form.formState.errors.phone.message}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={fieldLabelStyle}>Purpose</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {VISITOR_PURPOSE_OPTIONS.map((opt) => {
              const active = form.watch('purpose') === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => form.setValue('purpose', opt.value as VisitorPurpose)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: active ? palette.coralPrimary : palette.borderLight,
                    backgroundColor: active ? 'rgba(255, 90, 95, 0.08)' : '#fff',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: active ? palette.coralPrimary : palette.textLight,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {entryMode === 'DRIVE_IN' || overnight ? (
        <View style={{ gap: 12 }}>
          <SectionTitle title="Vehicle" />
          <View style={fieldGap ?? { gap: 6 }}>
            <Text style={fieldLabelStyle}>Plate number</Text>
            <TextInput
              value={form.watch('vehiclePlate') ?? ''}
              onChangeText={(v) => form.setValue('vehiclePlate', v)}
              style={inputStyle}
              autoCapitalize="characters"
            />
            {overnight ? (
              <Text style={{ fontSize: 12, color: palette.mutedLight, marginTop: 4 }}>
                Must match your plate photo — mismatches may suspend overnight registration
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <SectionTitle title="Arrival" />
        <TextInput
          value={
            expectedAt instanceof Date && !Number.isNaN(expectedAt.getTime())
              ? expectedAt.toISOString().slice(0, 16).replace('T', ' ')
              : ''
          }
          onChangeText={(v) => {
            const parsed = new Date(v.replace(' ', 'T'));
            if (!Number.isNaN(parsed.getTime())) form.setValue('expectedAt', parsed);
          }}
          style={inputStyle}
          placeholder="YYYY-MM-DD HH:mm"
        />
      </View>

      <View style={{ gap: 12 }}>
        <SectionTitle title="Overnight stay" description="Optional — visitor stays past midnight." />
        <Card
          style={{
            borderColor: overnight ? 'rgba(255, 90, 95, 0.35)' : palette.borderLight,
            backgroundColor: overnight ? 'rgba(255, 90, 95, 0.04)' : 'rgba(120, 113, 108, 0.06)',
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontWeight: '700' }}>Enable overnight</Text>
              <Text style={{ fontSize: 12, color: palette.mutedLight, marginTop: 2 }}>
                Drive-in only · plate photo required
              </Text>
            </View>
            <Switch
              value={Boolean(overnight)}
              onValueChange={(v) => form.setValue('overnight', v)}
              trackColor={{ true: palette.coralPrimary, false: palette.borderLight }}
            />
          </View>
        </Card>

        {overnight ? (
          <Card
            style={{
              backgroundColor: 'rgba(120, 113, 108, 0.06)',
              borderWidth: 1,
              borderColor: palette.borderLight,
            }}
          >
            <View style={{ gap: 12 }}>
            <Text style={fieldLabelStyle}>Plate photo (required)</Text>
            {platePhotoUri ? (
              <Image
                source={{ uri: platePhotoUri }}
                style={{ height: 140, borderRadius: radius.lg }}
              />
            ) : null}
            <Button
              title={
                uploadingPhoto
                  ? 'Uploading…'
                  : platePhotoKey
                    ? 'Retake photo'
                    : 'Capture plate photo'
              }
              variant="secondary"
              size="md"
              onPress={capturePlatePhoto}
              disabled={uploadingPhoto}
            />

            {showUrgentReason ? (
              <View>
                <Text style={[fieldLabelStyle, { marginBottom: 6 }]}>
                  Why is this urgent? (required)
                </Text>
                <TextInput
                  value={form.watch('urgentReason') ?? ''}
                  onChangeText={(v) => form.setValue('urgentReason', v)}
                  style={inputStyle}
                  placeholder="e.g. Family emergency travel"
                />
              </View>
            ) : null}

            {preview.data ? (
              <View
                style={{
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: 'rgba(14, 165, 233, 0.35)',
                  backgroundColor: 'rgba(240, 249, 255, 0.9)',
                  padding: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: '#0ea5e9',
                }}
              >
                <Text style={{ fontSize: 14, color: palette.textLight }}>
                  {preview.data.helperMessage}
                </Text>
                {preview.data.isHolidayAuto && !preview.data.slotsFull ? (
                  <Text style={{ fontWeight: '700', marginTop: 8, color: palette.textLight }}>
                    {preview.data.remainingSlots} of {preview.data.maxSlots} overnight slots left
                    tonight
                  </Text>
                ) : null}
                {preview.data.slotsFull ? (
                  <Text style={{ color: '#b91c1c', fontWeight: '700', marginTop: 8 }}>
                    No slots — contact management or register urgent and visit the office
                  </Text>
                ) : null}
              </View>
            ) : null}
            </View>
          </Card>
        ) : null}
      </View>

      <Button
        title={create.isPending ? 'Submitting…' : 'Create pass'}
        onPress={form.handleSubmit(onSubmit)}
        disabled={create.isPending || slotsBlocked || uploadingPhoto}
      />
    </View>
  );
}

const fieldLabelStyle = {
  fontWeight: '600' as const,
  fontSize: 13,
  color: palette.textLight,
  marginBottom: 6,
};

const inputStyle = {
  height: 44,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.borderLight,
  paddingHorizontal: 12,
  fontSize: 14,
  backgroundColor: '#fff',
};
