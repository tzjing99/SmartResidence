import { useCreateDefect, useMyUnits, useUnitDefects } from '@smartresidence/api-client';
import { AppText, Button, Card, EmptyState, Pill, palette, radius, spacing } from '@smartresidence/ui-mobile';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, TextInput, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  residentStyles,
} from '../../src/components/resident-screen';
import { api } from '../../src/lib/api';

export default function DefectsScreen() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const defects = useUnitDefects(api, unit?.id ?? null);
  const create = useCreateDefect(api);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  async function attach() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Camera permission needed');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri ?? null);
  }

  async function submit() {
    if (!unit || !title || !description) {
      Alert.alert('Please fill title and description');
      return;
    }
    try {
      // Note: attachment upload is presigned and uploaded separately in v0.2.
      await create.mutateAsync({
        unitId: unit.id,
        title,
        description,
        category: 'Other',
        severity: 'MEDIUM',
      });
      setTitle('');
      setDescription('');
      setPhotoUri(null);
    } catch (err) {
      Alert.alert('Could not submit', (err as Error).message);
    }
  }

  const items = (defects.data?.items as any[]) ?? [];

  return (
    <ResidentScreen
      eyebrow="Defects"
      title="Report a repair"
      subtitle="Send clear details to management and follow each defect until it is resolved."
    >
      <Card style={[residentStyles.card, { gap: spacing.sm }]}>
        <View style={{ gap: 4 }}>
          <AppText variant="subheading">Submit a defect</AppText>
          <AppText variant="meta" style={{ color: palette.mutedLight }}>
            A short title and photo help the team route it faster.
          </AppText>
        </View>
        <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={inputStyle} />
        <TextInput
          placeholder="What's wrong?"
          value={description}
          onChangeText={setDescription}
          multiline
          style={[
            inputStyle,
            { height: 90, marginTop: 10, textAlignVertical: 'top', paddingTop: 10 },
          ]}
        />
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{ height: 140, borderRadius: radius.lg, marginTop: 10 }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            title={photoUri ? 'Retake photo' : 'Take photo'}
            variant="secondary"
            size="sm"
            style={{ flexGrow: 1 }}
            onPress={attach}
          />
          <Button
            title={create.isPending ? 'Submitting…' : 'Submit'}
            loading={create.isPending}
            onPress={submit}
            size="sm"
            style={{ flexGrow: 1 }}
          />
        </View>
      </Card>

      <ResidentSectionHeader
        title="Repair history"
        subtitle="Open and completed reports stay here for reference."
      />

      {items.length === 0 ? (
        <EmptyState title="No defects yet" description="Repairs you submit will track here." />
      ) : (
        items.map((d) => (
          <Card key={d.id} style={residentStyles.card}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={{ fontWeight: '700', color: palette.textLight }} numberOfLines={2}>
                  {d.title}
                </AppText>
                <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 2 }}>
                  {d.category} · {new Date(d.createdAt).toLocaleDateString()}
                </AppText>
              </View>
              <Pill
                tone={
                  d.status === 'CLOSED' || d.status === 'RESOLVED'
                    ? 'success'
                    : d.status === 'NEW'
                      ? 'primary'
                      : 'info'
                }
                label={prettyLabel(d.status)}
              />
            </View>
          </Card>
        ))
      )}
    </ResidentScreen>
  );
}

const inputStyle = {
  minHeight: 46,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.borderLight,
  backgroundColor: palette.surfaceLight,
  paddingHorizontal: 12,
  fontSize: 14,
};
