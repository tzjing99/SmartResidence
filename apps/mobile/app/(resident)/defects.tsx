import { useState } from 'react';
import { Alert, Image, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, EmptyState, Pill, palette, radius } from '@smartresidence/ui-mobile';
import { useCreateDefect, useMyUnits, useUnitDefects } from '@smartresidence/api-client';
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
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Defects</Text>

      <Card>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Submit a defect</Text>
        <TextInput
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
          style={inputStyle}
        />
        <TextInput
          placeholder="What's wrong?"
          value={description}
          onChangeText={setDescription}
          multiline
          style={[inputStyle, { height: 90, marginTop: 10, textAlignVertical: 'top', paddingTop: 10 }]}
        />
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{ height: 140, borderRadius: radius.lg, marginTop: 10 }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button title="Take photo" variant="secondary" size="sm" onPress={attach} />
          <Button
            title={create.isPending ? 'Submitting…' : 'Submit'}
            loading={create.isPending}
            onPress={submit}
            size="sm"
          />
        </View>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="No defects yet" description="Repairs you submit will track here." />
      ) : (
        items.map((d) => (
          <Card key={d.id}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontWeight: '600' }}>{d.title}</Text>
                <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
                  {d.category} · {new Date(d.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Pill
                tone={
                  d.status === 'CLOSED' || d.status === 'RESOLVED'
                    ? 'success'
                    : d.status === 'NEW'
                      ? 'primary'
                      : 'info'
                }
                label={d.status.toLowerCase().replace('_', ' ')}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const inputStyle = {
  height: 44,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.borderLight,
  paddingHorizontal: 12,
  fontSize: 14,
};
