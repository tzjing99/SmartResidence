import {
  useAppealThread,
  useConfirmThreadResolution,
  usePostThreadMessage,
  useThread,
} from '@smartresidence/api-client';
import { Button, Card, Stack, palette } from '@smartresidence/ui-mobile';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

export default function MessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const thread = useThread(api, id ?? null);
  const post = usePostThreadMessage(api);
  const confirm = useConfirmThreadResolution(api);
  const appeal = useAppealThread(api);

  const [body, setBody] = useState('');
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectExpectation, setRejectExpectation] = useState('');
  const [appealMode, setAppealMode] = useState(false);
  const [appealReason, setAppealReason] = useState('');

  const t = thread.data;
  const threadId = id ?? '';
  if (!t || !threadId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const pending = t.status === 'PENDING_RESIDENT_CONFIRMATION';
  const finished = t.status === 'RESOLVED' || t.status === 'CLOSED';
  const proposed = t.messages.find((m) => m.id === t.resolutionProposedMessageId);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{t.subject}</Text>
      <Text style={{ color: palette.mutedLight, fontSize: 12 }}>
        {t.status} · {t.priority}
      </Text>

      {pending && !rejectMode ? (
        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Confirm resolution?</Text>
          {proposed ? (
            <View
              style={{
                backgroundColor: '#e0f2fe',
                padding: 10,
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369a1' }}>
                Proposed solution
              </Text>
              <Text style={{ marginTop: 4 }}>{proposed.body}</Text>
            </View>
          ) : null}
          <Stack gap={8}>
            <Button
              title="Confirm resolved"
              onPress={() => confirm.mutate({ id: threadId, confirmed: true })}
            />
            <Button title="Not resolved" variant="secondary" onPress={() => setRejectMode(true)} />
          </Stack>
        </Card>
      ) : null}

      {rejectMode ? (
        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Why not resolved?</Text>
          <TextInput
            value={rejectReason}
            onChangeText={setRejectReason}
            placeholder="Why rejecting?"
            multiline
            style={{
              borderWidth: 1,
              borderColor: palette.borderLight,
              borderRadius: 10,
              padding: 10,
              marginBottom: 8,
            }}
          />
          <TextInput
            value={rejectExpectation}
            onChangeText={setRejectExpectation}
            placeholder="What do you still need?"
            multiline
            style={{
              borderWidth: 1,
              borderColor: palette.borderLight,
              borderRadius: 10,
              padding: 10,
              marginBottom: 8,
            }}
          />
          <Stack gap={8}>
            <Button
              title="Submit"
              onPress={() =>
                confirm.mutate({
                  id: threadId,
                  confirmed: false,
                  rejectReason,
                  rejectExpectation,
                })
              }
            />
            <Button title="Cancel" variant="secondary" onPress={() => setRejectMode(false)} />
          </Stack>
        </Card>
      ) : null}

      {finished && !appealMode ? (
        <Button title="Appeal / reopen" variant="secondary" onPress={() => setAppealMode(true)} />
      ) : null}

      {appealMode ? (
        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Appeal reason (required)</Text>
          <TextInput
            value={appealReason}
            onChangeText={setAppealReason}
            placeholder="Why are you appealing?"
            multiline
            style={{
              borderWidth: 1,
              borderColor: palette.borderLight,
              borderRadius: 10,
              padding: 10,
              marginBottom: 8,
            }}
          />
          <Stack gap={8}>
            <Button
              title="Submit appeal"
              onPress={() => appeal.mutate({ id: threadId, reason: appealReason })}
            />
            <Button title="Cancel" variant="secondary" onPress={() => setAppealMode(false)} />
          </Stack>
        </Card>
      ) : null}

      {t.messages.map((m) => (
        <View
          key={m.id}
          style={{
            alignSelf: m.kind === 'SYSTEM' ? 'center' : 'stretch',
            backgroundColor: m.kind === 'SYSTEM' ? 'transparent' : palette.surfaceLight,
            padding: m.kind === 'SYSTEM' ? 4 : 12,
            borderRadius: 12,
            borderWidth: t.resolutionProposedMessageId === m.id ? 2 : 0,
            borderColor: '#0ea5e9',
          }}
        >
          <Text
            style={{
              fontSize: m.kind === 'SYSTEM' ? 11 : 14,
              color: m.kind === 'SYSTEM' ? palette.mutedLight : undefined,
            }}
          >
            {m.body}
          </Text>
        </View>
      ))}

      {!pending && !finished ? (
        <Card>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write a reply…"
            multiline
            style={{
              borderWidth: 1,
              borderColor: palette.borderLight,
              borderRadius: 10,
              padding: 10,
              minHeight: 80,
            }}
          />
          <View style={{ marginTop: 8 }}>
            <Button
              title="Send"
              onPress={() => {
                post.mutate({ id: threadId, body });
                setBody('');
              }}
            />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}
