import {
  useAppealThread,
  useConfirmThreadResolution,
  useMe,
  usePostThreadMessage,
  useThread,
  useThreadRoom,
} from '@smartresidence/api-client';
import {
  AlignRow,
  AppText,
  Button,
  Card,
  Field,
  Input,
  Pill,
  Stack,
  palette,
  radius,
} from '@smartresidence/ui-mobile';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ThreadMessageList } from '../../../src/components/thread-message-list';
import { api } from '../../../src/lib/api';
import { hapticLight } from '../../../src/lib/haptics';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  OPEN: 'info',
  AWAITING_MANAGEMENT: 'warning',
  AWAITING_RESIDENT: 'warning',
  PENDING_RESIDENT_CONFIRMATION: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REOPENED: 'warning',
};

export default function MessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe(api);
  const myId = (me.data as { user?: { id?: string } } | undefined)?.user?.id;
  const thread = useThread(api, id ?? null);
  useThreadRoom(id);
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
        <AppText variant="meta">Loading…</AppText>
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
      <AppText variant="heading">{t.subject}</AppText>
      <AlignRow gap={8}>
        <Pill tone={STATUS_TONE[t.status] ?? 'neutral'} label={t.status} />
        <Pill tone="neutral" label={t.priority} />
      </AlignRow>

      {pending && !rejectMode ? (
        <Card>
          <AppText variant="label" style={{ marginBottom: 8 }}>
            Confirm resolution?
          </AppText>
          {proposed ? (
            <View
              style={{
                backgroundColor: palette.surfaceLight,
                padding: 12,
                borderRadius: radius.lg,
                marginBottom: 10,
                gap: 4,
                borderWidth: 1,
                borderLeftWidth: 4,
                borderColor: '#0ea5e9',
              }}
            >
              <AppText
                variant="caption"
                style={{ color: '#0369a1', fontWeight: '700', textTransform: 'uppercase' }}
              >
                Suggested fix
              </AppText>
              <AppText variant="bodySm">{proposed.body}</AppText>
            </View>
          ) : null}
          <Stack gap={8}>
            <Button
              title="Confirm resolved"
              onPress={() => {
                void hapticLight();
                confirm.mutate({ id: threadId, confirmed: true });
              }}
            />
            <Button title="Not resolved" variant="secondary" onPress={() => setRejectMode(true)} />
          </Stack>
        </Card>
      ) : null}

      {rejectMode ? (
        <Card>
          <AppText variant="label" style={{ marginBottom: 8 }}>
            Why not resolved?
          </AppText>
          <Field>
            <Input
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Why rejecting?"
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }}
            />
          </Field>
          <Field containerStyle={{ marginTop: 8 }}>
            <Input
              value={rejectExpectation}
              onChangeText={setRejectExpectation}
              placeholder="What do you still need?"
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }}
            />
          </Field>
          <Stack gap={8} style={{ marginTop: 8 }}>
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
          <AppText variant="label" style={{ marginBottom: 8 }}>
            Appeal reason (required)
          </AppText>
          <Field>
            <Input
              value={appealReason}
              onChangeText={setAppealReason}
              placeholder="Why are you appealing?"
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }}
            />
          </Field>
          <Stack gap={8} style={{ marginTop: 8 }}>
            <Button
              title="Submit appeal"
              onPress={() => appeal.mutate({ id: threadId, reason: appealReason })}
            />
            <Button title="Cancel" variant="secondary" onPress={() => setAppealMode(false)} />
          </Stack>
        </Card>
      ) : null}

      <ThreadMessageList
        messages={t.messages}
        variant="resident"
        viewerId={myId}
        residentId={t.createdBy?.id}
        resolutionProposedMessageId={t.resolutionProposedMessageId}
      />

      {!pending && !finished ? (
        <Card>
          <Field>
            <Input
              value={body}
              onChangeText={setBody}
              placeholder="Write a reply…"
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }}
            />
          </Field>
          <View style={{ marginTop: 8 }}>
            <Button
              title="Send"
              onPress={() => {
                void hapticLight();
                const text = body.trim();
                if (!text) return;
                setBody('');
                post.mutate({ id: threadId, body: text }, { onError: () => setBody(text) });
              }}
            />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}
