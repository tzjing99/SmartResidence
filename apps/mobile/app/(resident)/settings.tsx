import { usePreferences, useUpdatePreferences } from '@smartresidence/api-client';
import {
  AlignRow,
  AppText,
  Button,
  Card,
  Field,
  Input,
  palette,
} from '@smartresidence/ui-mobile';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { api } from '../../src/lib/api';

export default function SettingsScreen() {
  const prefs = usePreferences(api);
  const save = useUpdatePreferences(api);

  const [emailNotifications, setEmailNotifications] = useState(false);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');

  useEffect(() => {
    if (!prefs.data) return;
    setEmailNotifications(prefs.data.emailNotifications);
    setQuietEnabled(prefs.data.quietHours.enabled);
    setQuietStart(prefs.data.quietHours.start);
    setQuietEnd(prefs.data.quietHours.end);
  }, [prefs.data]);

  async function onSave() {
    try {
      await save.mutateAsync({
        emailNotifications,
        quietHours: { enabled: quietEnabled, start: quietStart, end: quietEnd },
      });
      Alert.alert('Saved', 'Notification preferences updated');
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <AppText variant="title">Settings</AppText>
      <AppText variant="subheading">Notifications</AppText>
      <AppText variant="meta">
        In-app and push stay on by default. Configure email opt-in and quiet hours below.
      </AppText>

      <Card>
        <AlignRow style={{ alignItems: 'flex-start', minHeight: 0 }}>
          <View style={{ flex: 1, paddingRight: 12, gap: 4 }}>
            <AppText variant="label">Email for threads</AppText>
            <AppText variant="meta">Opt in to email notifications for helpdesk updates</AppText>
          </View>
          <Switch value={emailNotifications} onValueChange={setEmailNotifications} />
        </AlignRow>
      </Card>

      <Card>
        <AlignRow style={{ alignItems: 'flex-start', minHeight: 0 }}>
          <View style={{ flex: 1, paddingRight: 12, gap: 4 }}>
            <AppText variant="label">Quiet hours</AppText>
            <AppText variant="meta">Suppress push during these hours (in-app still delivered)</AppText>
          </View>
          <Switch value={quietEnabled} onValueChange={setQuietEnabled} />
        </AlignRow>
        {quietEnabled ? (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <Field label="From" containerStyle={{ flex: 1 }}>
              <Input value={quietStart} onChangeText={setQuietStart} placeholder="22:00" />
            </Field>
            <Field label="Until" containerStyle={{ flex: 1 }}>
              <Input value={quietEnd} onChangeText={setQuietEnd} placeholder="07:00" />
            </Field>
          </View>
        ) : null}
      </Card>

      <Button title={save.isPending ? 'Saving…' : 'Save preferences'} onPress={onSave} />
    </ScrollView>
  );
}
