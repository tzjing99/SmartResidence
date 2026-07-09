import {
  useCreateThread,
  useFaqDeflectMatch,
  useMarkFaqHelpful,
  useMyCondos,
  useMyUnits,
} from '@smartresidence/api-client';
import type { ThreadCategory } from '@smartresidence/api-client';
import { AppText, Button, Card, useTheme } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoPicker } from '../../../src/components/photo-picker';
import { useT } from '../../../src/i18n/locale-provider';
import { api } from '../../../src/lib/api';
import { usePhotoUpload } from '../../../src/lib/use-photo-upload';

const CATEGORIES: Array<{ value: ThreadCategory; labelKey: string }> = [
  { value: 'BILLING', labelKey: 'helpdesk.category.BILLING' },
  { value: 'MAINTENANCE', labelKey: 'helpdesk.category.MAINTENANCE' },
  { value: 'FACILITY', labelKey: 'helpdesk.category.FACILITY' },
  { value: 'SECURITY', labelKey: 'helpdesk.category.SECURITY' },
  { value: 'COMPLAINT', labelKey: 'helpdesk.category.COMPLAINT' },
  { value: 'SUGGESTION', labelKey: 'helpdesk.category.SUGGESTION' },
  { value: 'GOVERNANCE', labelKey: 'helpdesk.category.GOVERNANCE' },
  { value: 'GENERAL', labelKey: 'helpdesk.category.GENERAL' },
];

export default function NewMessageScreen() {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
      Alert.alert(t('mobile.messages.missingFields'), t('mobile.messages.missingFieldsBody'));
      return;
    }
    if (photos.uploading) {
      Alert.alert(t('mobile.messages.pleaseWait'), t('mobile.messages.photosUploading'));
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
      Alert.alert(t('mobile.messages.errorTitle'), (err as Error).message);
    }
  }

  async function onAnswered() {
    if (!deflection) return;
    try {
      await helpful.mutateAsync(deflection.articleId);
      Alert.alert(t('mobile.messages.faqHelpedTitle'), t('mobile.messages.faqHelpedBody'));
      router.back();
    } catch (err) {
      Alert.alert(t('mobile.messages.errorTitle'), (err as Error).message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <AppText style={{ fontSize: 24, fontWeight: '700' }}>{t('messages.new')}</AppText>

        {deflection && !dismissed ? (
          <Card>
            <AppText style={{ fontWeight: '600', color: '#16a34a' }}>
              {t('messages.deflectTitle')}
            </AppText>
            <AppText style={{ fontWeight: '600', marginTop: 8 }}>{deflection.question}</AppText>
            <AppText style={{ color: colors.muted, marginTop: 6 }}>{deflection.answer}</AppText>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button title={t('messages.deflectAnswered')} onPress={onAnswered} />
            </View>
            <Pressable
              onPress={() => {
                setDismissed(true);
                setDeflection(null);
              }}
              style={{ marginTop: 8, minHeight: 44, justifyContent: 'center' }}
            >
              <AppText style={{ color: colors.coral, textAlign: 'center' }}>
                {t('messages.deflectStillNeedHelp')}
              </AppText>
            </Pressable>
          </Card>
        ) : null}

        <Card>
          <AppText style={{ fontWeight: '600', marginBottom: 8 }}>{t('messages.subject')}</AppText>
          <TextInput
            value={subject}
            onChangeText={(v) => {
              setSubject(v);
              setDismissed(false);
            }}
            placeholderTextColor={colors.muted}
            placeholder={t('messages.subjectPlaceholder')}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              color: colors.fg,
              backgroundColor: colors.inputBg,
            }}
          />
          <AppText style={{ fontWeight: '600', marginTop: 12, marginBottom: 8 }}>
            {t('messages.category')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map((c) => {
              const selected = category === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: selected ? colors.coral : colors.coralSoft,
                    borderWidth: 1,
                    borderColor: selected ? colors.coral : colors.cardBorder,
                  }}
                >
                  <AppText
                    style={{
                      color: selected ? '#fff' : colors.fg,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {t(c.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText style={{ fontWeight: '600', marginTop: 12, marginBottom: 8 }}>
            {t('messages.bodyLabel')}
          </AppText>
          <TextInput
            value={body}
            onChangeText={(v) => {
              setBody(v);
              setDismissed(false);
            }}
            multiline
            numberOfLines={5}
            placeholderTextColor={colors.muted}
            placeholder={t('messages.bodyPlaceholder')}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              minHeight: 120,
              textAlignVertical: 'top',
              color: colors.fg,
              backgroundColor: colors.inputBg,
            }}
          />
          <AppText style={{ fontWeight: '600', marginTop: 12, marginBottom: 8 }}>
            {t('upload.photos')}
          </AppText>
          <PhotoPicker controller={photos} />
          <View style={{ marginTop: 16 }}>
            <Button
              title={create.isPending ? t('messages.sending') : t('messages.send')}
              onPress={onSend}
              disabled={create.isPending || photos.uploading}
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
