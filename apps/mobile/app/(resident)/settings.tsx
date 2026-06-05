import { usePreferences, useUpdatePreferences } from '@smartresidence/api-client';
import { Button, Card, palette } from '@smartresidence/ui-mobile';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, View } from 'react-native';
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
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Notifications</Text>
      <Text style={{ color: palette.mutedLight, fontSize: 13 }}>
        In-app and push stay on by default. Configure email opt-in and quiet hours below.
      </Text>

      <Card>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontWeight: '600' }}>Email for threads</Text>
            <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 4 }}>
              Opt in to email notifications for helpdesk updates
            </Text>
          </View>
          <Switch value={emailNotifications} onValueChange={setEmailNotifications} />
        </View>
      </Card>

      <Card>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontWeight: '600' }}>Quiet hours</Text>
            <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 4 }}>
              Suppress push during these hours (in-app still delivered)
            </Text>
          </View>
          <Switch value={quietEnabled} onValueChange={setQuietEnabled} />
        </View>
        {quietEnabled ? (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: palette.mutedLight }}>From</Text>
              <TextInput
                value={quietStart}
                onChangeText={setQuietStart}
                placeholder="22:00"
                style={{
                  borderWidth: 1,
                  borderColor: palette.borderLight,
                  borderRadius: 12,
                  padding: 10,
                  marginTop: 4,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: palette.mutedLight }}>Until</Text>
              <TextInput
                value={quietEnd}
                onChangeText={setQuietEnd}
                placeholder="07:00"
                style={{
                  borderWidth: 1,
                  borderColor: palette.borderLight,
                  borderRadius: 12,
                  padding: 10,
                  marginTop: 4,
                }}
              />
            </View>
          </View>
        ) : null}
      </Card>

      <Button title={save.isPending ? 'Saving…' : 'Save preferences'} onPress={onSave} />
    </ScrollView>
  );
}
