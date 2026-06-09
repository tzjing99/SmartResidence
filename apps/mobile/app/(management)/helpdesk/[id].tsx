import {
  useMe,
  useThread,
  usePostThreadMessage,
  useUpdateThread,
  useProposeThreadResolution,
  useRequestThreadResident,
  useCloseAbusiveThread,
} from '@smartresidence/api-client';
import { useThreadRoom } from '@smartresidence/api-client/realtime';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, Alert, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThreadMessageList } from '../../../src/components/thread-message-list';
import { api } from '../../../src/lib/api';
import { hapticLight } from '../../../src/lib/haptics';
import { useTabletLayout } from '../../../src/lib/use-tablet-layout';

const PRIORITY_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  URGENT: 'danger',
  HIGH: 'warning',
  NORMAL: 'info',
  LOW: 'success',
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  OPEN: 'info',
  AWAITING_MANAGEMENT: 'warning',
  AWAITING_RESIDENT: 'neutral',
  PENDING_RESIDENT_CONFIRMATION: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REOPENED: 'warning',
};

const SLA_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  BREACHED: 'danger',
  AT_RISK: 'warning',
  ON_TRACK: 'success',
  NONE: 'neutral',
};

const mapStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    OPEN: 'Open',
    AWAITING_RESIDENT: 'Awaiting Resident',
    AWAITING_MANAGEMENT: 'Awaiting Management',
    PENDING_RESIDENT_CONFIRMATION: 'Pending Confirmation',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
    REOPENED: 'Reopened',
  };
  return map[status] ?? status;
};

const mapPriorityLabel = (priority: string): string => {
  const map: Record<string, string> = {
    URGENT: 'Urgent',
    HIGH: 'High',
    NORMAL: 'Normal',
    LOW: 'Low',
  };
  return map[priority] ?? priority;
};

export default function ManagementThreadDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();
  const me = useMe(api);
  const myId = (me.data as { user?: { id?: string } } | undefined)?.user?.id;
  const thread = useThread(api, id ?? null);
  useThreadRoom(id);

  const post = usePostThreadMessage(api);
  const update = useUpdateThread(api);
  const propose = useProposeThreadResolution(api);
  const requestResident = useRequestThreadResident(api);
  const closeAbusive = useCloseAbusiveThread(api);

  const [body, setBody] = useState('');
  const [internalNote, setInternalNote] = useState(false);

  // Toggle action sub-forms
  const [actionForm, setActionForm] = useState<'propose' | 'request' | 'abuse' | null>(null);
  const [actionText, setActionFormText] = useState('');

  const t = thread.data;
  const threadId = id ?? '';
  const contentContainerStyle = useMemo(
    () => [
      styles.listContent,
      {
        maxWidth: contentMaxWidth,
        paddingHorizontal: horizontalPadding,
        paddingTop: 16,
        paddingBottom: Math.max(insets.bottom, 16) + 44,
      },
    ],
    [contentMaxWidth, horizontalPadding, insets.bottom],
  );

  if (!t || !threadId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bgLight }}>
        <AppText variant="meta">Loading ticket details…</AppText>
      </View>
    );
  }

  const finished = t.status === 'RESOLVED' || t.status === 'CLOSED';

  const handleClaimTicket = async () => {
    if (!myId) return;
    try {
      void hapticLight();
      await update.mutateAsync({ id: threadId, assignedToUserId: myId });
      Alert.alert('Success', 'You have claimed this ticket.');
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  };

  const handleUpdatePriority = async (p: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW') => {
    try {
      void hapticLight();
      await update.mutateAsync({ id: threadId, priority: p });
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  };

  const handleSubmitReply = () => {
    void hapticLight();
    const text = body.trim();
    if (!text) return;
    setBody('');
    post.mutate(
      { id: threadId, body: text, internalNote },
      {
        onError: () => setBody(text),
      }
    );
  };

  const handleExecuteActionForm = async () => {
    const text = actionText.trim();
    if (!text && actionForm !== 'request') {
      Alert.alert('Required', 'Please enter a message/reason.');
      return;
    }

    try {
      void hapticLight();
      if (actionForm === 'propose') {
        await propose.mutateAsync({ id: threadId, note: text });
        Alert.alert('Success', 'Proposed resolution sent to resident.');
      } else if (actionForm === 'request') {
        await requestResident.mutateAsync({ id: threadId, body: text });
        Alert.alert('Success', 'Clarification request sent.');
      } else if (actionForm === 'abuse') {
        await closeAbusive.mutateAsync({ id: threadId, reason: text });
        Alert.alert('Success', 'Ticket closed as abusive.');
      }
      setActionForm(null);
      setActionFormText('');
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  };

  const header = (
    <>
      {/* Title & Stats */}
      <View style={{ gap: 6 }}>
        <AppText variant="heading" style={{ fontSize: 20 }}>{t.subject}</AppText>
        <AlignRow gap={8}>
          <Pill tone={STATUS_TONE[t.status] ?? 'neutral'} label={mapStatusLabel(t.status)} />
          <Pill tone={PRIORITY_TONE[t.priority] ?? 'neutral'} label={mapPriorityLabel(t.priority)} />
          {t.slaState && t.slaState !== 'NONE' && (
            <Pill tone={SLA_TONE[t.slaState] ?? 'neutral'} label={`SLA: ${t.slaState}`} />
          )}
        </AlignRow>
        <AppText variant="caption" style={{ color: palette.mutedLight, marginTop: 4 }}>
          Created by: <AppText variant="caption" style={{ fontWeight: '600' }}>{t.createdBy?.name ?? 'Resident'}</AppText>
          {t.unit ? ` (${t.unit.identifier})` : ''} • {new Date(t.createdAt).toLocaleDateString()}
        </AppText>
      </View>

      {/* Assignment Card */}
      <Card style={{ padding: 16, gap: 10 }}>
        <AppText variant="label">Assignment Status</AppText>
        {t.assignedTo ? (
          <AlignRow style={{ justifyContent: 'space-between', minHeight: 0 }}>
            <AppText variant="bodySm">
              Assigned to: <AppText variant="bodySm" style={{ fontWeight: '600' }}>{t.assignedTo.name}</AppText>
            </AppText>
            {t.assignedTo.id !== myId && (
              <Pressable onPress={handleClaimTicket} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: palette.coralPrimary }}>
                <AppText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Reassign to me</AppText>
              </Pressable>
            )}
          </AlignRow>
        ) : (
          <AlignRow style={{ justifyContent: 'space-between', minHeight: 0 }}>
            <AppText variant="bodySm" style={{ color: palette.mutedLight, fontStyle: 'italic' }}>Unassigned ticket</AppText>
            <Button
              title="Claim Ticket"
              variant="primary"
              style={{ minHeight: 32, paddingVertical: 4, paddingHorizontal: 12 }}
              onPress={handleClaimTicket}
            />
          </AlignRow>
        )}
      </Card>

      {/* Triage / Management Actions */}
      {!finished && (
        <Card style={{ padding: 16, gap: 12 }}>
          <AppText variant="label">Triage & Actions</AppText>

          {/* Change Priority Quick Buttons */}
          <View style={{ gap: 6 }}>
            <AppText variant="caption" style={{ color: palette.mutedLight }}>Update Priority:</AppText>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const).map((p) => {
                const isActive = t.priority === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => handleUpdatePriority(p)}
                    style={{
                      flex: 1,
                      paddingVertical: 6,
                      borderRadius: radius.md,
                      backgroundColor: isActive ? PRIORITY_TONE[p] === 'danger' ? '#FEE2E2' : PRIORITY_TONE[p] === 'warning' ? '#FEF3C7' : PRIORITY_TONE[p] === 'info' ? '#E0F2FE' : '#D1FAE5' : '#F3F4F6',
                      borderWidth: 1,
                      borderColor: isActive ? PRIORITY_TONE[p] === 'danger' ? '#EF4444' : PRIORITY_TONE[p] === 'warning' ? '#F59E0B' : PRIORITY_TONE[p] === 'info' ? '#0EA5E9' : '#10B981' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <AppText
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: isActive ? PRIORITY_TONE[p] === 'danger' ? '#991B1B' : PRIORITY_TONE[p] === 'warning' ? '#92400E' : PRIORITY_TONE[p] === 'info' ? '#0369A1' : '#065F46' : palette.mutedLight,
                      }}
                    >
                      {mapPriorityLabel(p)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Action Row Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Button
              title="Propose Solved"
              variant="soft-primary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                setActionForm(actionForm === 'propose' ? null : 'propose');
                setActionFormText('');
              }}
            />
            <Button
              title="Request Info"
              variant="soft-sky"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                setActionForm(actionForm === 'request' ? null : 'request');
                setActionFormText('');
              }}
            />
            <Button
              title="Close Abuse"
              variant="destructive"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                setActionForm(actionForm === 'abuse' ? null : 'abuse');
                setActionFormText('');
              }}
            />
          </View>

          {/* Collapsible Action Sub-forms */}
          {actionForm && (
            <View style={{ borderTopWidth: 1, borderTopColor: palette.borderLight, paddingTop: 12, marginTop: 4, gap: 10 }}>
              <AppText variant="label" style={{ fontSize: 13 }}>
                {actionForm === 'propose' && 'Propose Resolution to Resident'}
                {actionForm === 'request' && 'Request Clarification from Resident'}
                {actionForm === 'abuse' && 'Close Ticket as Abusive / Spam'}
              </AppText>
              <Field>
                <Input
                  value={actionText}
                  onChangeText={setActionFormText}
                  placeholder={
                    actionForm === 'propose'
                      ? 'Describe how this issue was resolved...'
                      : actionForm === 'request'
                      ? 'What information is needed from the resident?'
                      : 'Provide a reason for closing as abusive...'
                  }
                  multiline
                  style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }}
                />
              </Field>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  style={{ flex: 1, minHeight: 36 }}
                  onPress={() => setActionForm(null)}
                />
                <Button
                  title="Submit Action"
                  variant="primary"
                  style={{ flex: 1, minHeight: 36, backgroundColor: actionForm === 'abuse' ? '#EF4444' : actionForm === 'propose' ? '#10B981' : palette.coralPrimary }}
                  onPress={handleExecuteActionForm}
                />
              </View>
            </View>
          )}
        </Card>
      )}

      {/* Messages Feed */}
      <View style={{ gap: 8 }}>
        <AppText variant="label">Discussion Thread</AppText>
      </View>
    </>
  );

  const footer = !finished ? (
        <Card style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="label">New Reply</AppText>
            {/* Simple Segmented Toggle for Normal vs Internal */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: radius.md, padding: 2 }}>
              <Pressable
                onPress={() => setInternalNote(false)}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: radius.md - 2,
                  backgroundColor: !internalNote ? '#FFFFFF' : 'transparent',
                }}
              >
                <AppText style={{ fontSize: 11, fontWeight: '600', color: !internalNote ? palette.coralPrimary : palette.mutedLight }}>
                  Resident
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => setInternalNote(true)}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: radius.md - 2,
                  backgroundColor: internalNote ? '#FEF3C7' : 'transparent',
                }}
              >
                <AppText style={{ fontSize: 11, fontWeight: '600', color: internalNote ? '#B45309' : palette.mutedLight }}>
                  Internal Note
                </AppText>
              </Pressable>
            </View>
          </View>

          <Field>
            <Input
              value={body}
              onChangeText={setBody}
              placeholder={internalNote ? "Write a private internal note..." : "Reply to resident..."}
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }}
            />
          </Field>

          <Button
            title={internalNote ? "Post Internal Note" : "Send Reply"}
            variant="primary"
            style={{ backgroundColor: internalNote ? '#F59E0B' : palette.coralPrimary }}
            onPress={handleSubmitReply}
            disabled={!body.trim()}
          />
        </Card>
  ) : null;

  return (
    <ThreadMessageList
      messages={t.messages}
      variant="admin"
      viewerId={myId}
      residentId={t.createdBy?.id}
      resolutionProposedMessageId={t.resolutionProposedMessageId}
      style={styles.screen}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bgLight,
  },
  listContent: {
    width: '100%',
    alignSelf: 'center',
  },
});
