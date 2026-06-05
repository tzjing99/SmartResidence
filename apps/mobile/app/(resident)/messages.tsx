import { useThreads } from '@smartresidence/api-client';
import { Card, palette } from '@smartresidence/ui-mobile';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../src/lib/api';

export default function MessagesScreen() {
  const router = useRouter();
  const threads = useThreads(api, { limit: 50 });

  const items = threads.data?.items ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Messages</Text>
      {items.length === 0 ? (
        <Text style={{ color: palette.mutedLight }}>No conversations yet.</Text>
      ) : (
        items.map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/(resident)/messages/${t.id}`)}>
            <Card>
              <Text style={{ fontWeight: '600' }}>{t.subject}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: palette.mutedLight }}>{t.status}</Text>
                <Text style={{ fontSize: 12, color: palette.mutedLight }}>{t.priority}</Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
