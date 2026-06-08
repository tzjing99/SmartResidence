import {
  useCreateThread,
  useFaqDeflectMatch,
  useMarkFaqHelpful,
  useMyCondos,
  useMyUnits,
} from '@smartresidence/api-client';
import type { ThreadCategory } from '@smartresidence/api-client';
import { Button, Card, palette } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { PhotoPicker } from '../../../src/components/photo-picker';
import { api } from '../../../src/lib/api';
import { usePhotoUpload } from '../../../src/lib/use-photo-upload';

const CATEGORIES: Array<{ value: ThreadCategory; label: string }> = [
  { value: 'BILLING', label: 'Billing' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'FACILITY', label: 'Facilities' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'COMPLAINT', label: 'Complaint' },
  { value: 'SUGGESTION', label: 'Suggestion' },
  { value: 'GOVERNANCE', label: 'Governance' },
  { value: 'GENERAL', label: 'General' },
];

export default function NewMessageScreen() {
  const router = useRouter();
  const units = useMyUnits(api);
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const unit = units.data?.[0] as { id: string } | undefined;
  const create = useCreateThread(api);
  const deflect = useFaqDeflectMatch(api);
  const helpful = useMarkFaqHelpful(api);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<ThreadCategory>('GENERAL');
  const [body, setBody] = useState('');
  const [deflection, setDeflection] = useState<{
    articleId: string;
    question: string;
    answer: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const photos = usePhotoUpload();

  useEffect(() => {
    if (!condo?.id || subject.trim().length < 5 || body.trim().length < 10 || dismissed) {
      if (!dismissed) setDeflection(null);
      return;
    }
    const timer = setTimeout(() => {
      deflect
        .mutateAsync({ condoId: condo.id, subject: subject.trim(), body: body.trim() })
        .then((res) => {
          if (res.match) {
            setDeflection({
              articleId: res.match.articleId,
              question: res.match.question,
              answer: res.match.answer,
            });
          } else {
            setDeflection(null);
          }
        })
        .catch(() => setDeflection(null));
    }, 700);
    return () => clearTimeout(timer);
  }, [condo?.id, subject, body, dismissed, deflect]);

  async function onSend() {
    if (!subject.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Add a subject and message');
      return;
    }
    if (photos.uploading) {
      Alert.alert('Please wait', 'Photos are still uploading.');
      return;
    }
    try {
      const thread = await create.mutateAsync({
        unitId: unit?.id,
        subject: subject.trim(),
        category,
        body: body.trim(),
        attachmentIds: photos.attachmentIds.length ? photos.attachmentIds : undefined,
      });
      photos.reset();
      router.replace(`/(resident)/messages/${thread.id}` as Href);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  }

  async function onAnswered() {
    if (!deflection) return;
    try {
      await helpful.mutateAsync(deflection.articleId);
      Alert.alert('Thanks!', 'Glad the FAQ helped — no thread opened.');
      router.back();
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>New message</Text>

      {deflection && !dismissed ? (
        <Card>
          <Text style={{ fontWeight: '600', color: '#16a34a' }}>FAQ might answer this</Text>
          <Text style={{ fontWeight: '600', marginTop: 8 }}>{deflection.question}</Text>
          <Text style={{ color: palette.mutedLight, marginTop: 6 }}>{deflection.answer}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button title="This answered my question" onPress={onAnswered} />
          </View>
          <Pressable
            onPress={() => {
              setDismissed(true);
              setDeflection(null);
            }}
            style={{ marginTop: 8 }}
          >
            <Text style={{ color: palette.coralPrimary, textAlign: 'center' }}>
              Still need help
            </Text>
          </Pressable>
        </Card>
      ) : null}

      <Card>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Subject</Text>
        <TextInput
          value={subject}
          onChangeText={(v) => {
            setSubject(v);
            setDismissed(false);
          }}
          style={{
            borderWidth: 1,
            borderColor: palette.borderLight,
            borderRadius: 12,
            padding: 12,
          }}
        />
        <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 8 }}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.value}
              onPress={() => setCategory(c.value)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: category === c.value ? palette.coralPrimary : palette.borderLight,
              }}
            >
              <Text
                style={{ color: category === c.value ? '#fff' : palette.textLight, fontSize: 12 }}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 8 }}>Message</Text>
        <TextInput
          value={body}
          onChangeText={(v) => {
            setBody(v);
            setDismissed(false);
          }}
          multiline
          numberOfLines={5}
          style={{
            borderWidth: 1,
            borderColor: palette.borderLight,
            borderRadius: 12,
            padding: 12,
            minHeight: 120,
            textAlignVertical: 'top',
          }}
        />
        <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 8 }}>Photos</Text>
        <PhotoPicker controller={photos} />
        <View style={{ marginTop: 16 }}>
          <Button
            title={create.isPending ? 'Sending…' : 'Send message'}
            onPress={onSend}
            disabled={create.isPending || photos.uploading}
          />
        </View>
      </Card>
    </ScrollView>
  );
}
