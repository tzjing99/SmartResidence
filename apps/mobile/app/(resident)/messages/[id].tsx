import { Ionicons } from '@expo/vector-icons';
import {
  useAppealThread,
  useConfirmThreadResolution,
  useMe,
  usePostThreadMessage,
  useThread,
} from '@smartresidence/api-client';
import { useThreadRoom } from '@smartresidence/api-client/realtime';
import {
  AppText,
  Button,
  Card,
  Field,
  Input,
  MetaLine,
  Pill,
  Stack,
  type ThemeColors,
  radius,
  spacing,
  useTheme,
} from '@smartresidence/ui-mobile';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { prettyLabel, useResidentStyles } from '../../../src/components/resident-screen';
import { ThreadMessageList } from '../../../src/components/thread-message-list';
import { api } from '../../../src/lib/api';
import { hapticLight } from '../../../src/lib/haptics';
import { useTabletLayout } from '../../../src/lib/use-tablet-layout';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  OPEN: 'info',
  AWAITING_MANAGEMENT: 'warning',
  AWAITING_RESIDENT: 'neutral',
  PENDING_RESIDENT_CONFIRMATION: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REOPENED: 'warning',
};

const PRIORITY_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  URGENT: 'danger',
  HIGH: 'warning',
  NORMAL: 'info',
  LOW: 'success',
};

export default function MessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const residentStyles = useResidentStyles();
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();
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
  const contentContainerStyle = useMemo(
    () => [
      styles.listContent,
      {
        maxWidth: contentMaxWidth,
        paddingHorizontal: horizontalPadding,
        paddingTop: Math.max(insets.top + 24, 36),
        paddingBottom: Math.max(insets.bottom, 16) + 84,
      },
    ],
    [contentMaxWidth, horizontalPadding, insets.bottom, insets.top, styles],
  );
  const sendReply = useCallback(() => {
    void hapticLight();
    const text = body.trim();
    if (!text) return;
    setBody('');
    post.mutate({ id: threadId, body: text }, { onError: () => setBody(text) });
  }, [body, post, threadId]);

  if (!t || !threadId) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <AppText variant="meta">Loading…</AppText>
      </View>
    );
  }

  const pending = t.status === 'PENDING_RESIDENT_CONFIRMATION';
  const finished = t.status === 'RESOLVED' || t.status === 'CLOSED';
  const proposed = t.messages.find((m) => m.id === t.resolutionProposedMessageId);
  const createdLabel = new Date(t.createdAt).toLocaleDateString();
  const canSendReply = Boolean(body.trim()) && !post.isPending;

  const header = (
    <>
      <View style={residentStyles.header}>
        <View style={residentStyles.headerCopy}>
          <AppText variant="caption" style={residentStyles.eyebrow}>
            Message
          </AppText>
          <AppText numberOfLines={2} style={residentStyles.title}>
            Thread details
          </AppText>
          <AppText numberOfLines={3} style={residentStyles.subtitle}>
            Follow the conversation with management.
          </AppText>
        </View>
      </View>

      <Card style={[residentStyles.card, styles.threadHeaderCard]}>
        <View style={styles.threadHeaderTop}>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <AppText variant="caption" style={styles.threadEyebrow}>
              Conversation
            </AppText>
            <AppText variant="subheading" numberOfLines={3} style={styles.threadSubject}>
              {t.subject}
            </AppText>
          </View>
          <View style={styles.pillStack}>
            <Pill tone={STATUS_TONE[t.status] ?? 'neutral'} label={prettyLabel(t.status)} />
            <Pill tone={PRIORITY_TONE[t.priority] ?? 'neutral'} label={prettyLabel(t.priority)} />
          </View>
        </View>
        <MetaLine
          parts={[
            prettyLabel(t.category),
            `${t.messages.length} messages`,
            `opened ${createdLabel}`,
          ]}
        />
      </Card>

      {pending && !rejectMode ? (
        <Card style={[residentStyles.card, styles.actionCard]}>
          <AppText variant="label" style={{ marginBottom: 8 }}>
            Confirm resolution?
          </AppText>
          {proposed ? (
            <View
              style={{
                backgroundColor: colors.messageMgmtSkyBg,
                padding: 12,
                borderRadius: radius.lg,
                marginBottom: 10,
                gap: 4,
                borderWidth: 1,
                borderLeftWidth: 4,
                borderColor: colors.messageMgmtSkyBorder,
              }}
            >
              <AppText
                variant="caption"
                style={{
                  color: colors.messageMgmtSkyText,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                }}
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
        <Card style={[residentStyles.card, styles.actionCard]}>
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
        <Button title="Appeal or reopen" variant="secondary" onPress={() => setAppealMode(true)} />
      ) : null}

      {appealMode ? (
        <Card style={[residentStyles.card, styles.actionCard]}>
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

      <View style={styles.threadPanel}>
        <View style={styles.threadSectionHeader}>
          <AppText variant="label">Conversation</AppText>
          <AppText variant="meta" style={{ color: colors.muted }}>
            Replies appear here as they arrive.
          </AppText>
        </View>
      </View>
    </>
  );

  const footer =
    !pending && !finished ? (
      <Card style={styles.composerCard}>
        <View style={styles.composerHeader}>
          <View>
            <AppText variant="label">Write a reply</AppText>
            <AppText variant="meta" style={{ color: colors.muted }}>
              {body.trim()
                ? post.isPending
                  ? 'Sending your reply...'
                  : 'Tap send when ready.'
                : 'Management will see your message here.'}
            </AppText>
          </View>
        </View>
        <View style={styles.composerBar}>
          <Input
            value={body}
            onChangeText={setBody}
            placeholder="Write a reply…"
            multiline
            blurOnSubmit={false}
            returnKeyType="default"
            enablesReturnKeyAutomatically
            style={styles.replyInput}
          />
          <Pressable
            onPress={sendReply}
            disabled={!canSendReply}
            accessibilityRole="button"
            accessibilityLabel={post.isPending ? 'Sending reply' : 'Send reply'}
            accessibilityState={{ disabled: !canSendReply, busy: post.isPending }}
            style={({ pressed }) => [
              styles.sendButton,
              post.isPending
                ? styles.sendButtonBusy
                : !canSendReply
                  ? styles.sendButtonDisabled
                  : null,
              pressed && canSendReply ? styles.sendButtonPressed : null,
            ]}
          >
            {post.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons
                name="paper-plane"
                size={18}
                color={canSendReply ? '#FFFFFF' : colors.coral}
              />
            )}
          </Pressable>
        </View>
      </Card>
    ) : null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ThreadMessageList
        messages={t.messages}
        variant="resident"
        viewerId={myId}
        residentId={t.createdBy?.id}
        resolutionProposedMessageId={t.resolutionProposedMessageId}
        style={styles.screen}
        contentContainerStyle={contentContainerStyle}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    listContent: {
      width: '100%',
      alignSelf: 'center',
    },
    threadHeaderCard: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    threadHeaderTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    threadEyebrow: {
      color: colors.coral,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    threadSubject: {
      color: colors.fg,
      lineHeight: 26,
    },
    pillStack: {
      alignItems: 'flex-end',
      gap: 6,
      maxWidth: 132,
    },
    actionCard: {
      padding: spacing.md,
    },
    threadPanel: {
      gap: spacing.sm,
    },
    threadSectionHeader: {
      paddingHorizontal: 2,
      gap: 2,
    },
    composerCard: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.sm,
      gap: 10,
      borderRadius: radius['2xl'],
      backgroundColor: colors.card,
      shadowColor: '#1F2937',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    composerHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: 4,
    },
    composerBar: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radius['2xl'],
      backgroundColor: colors.inputBg,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    replyInput: {
      flex: 1,
      minHeight: 42,
      maxHeight: 112,
      height: undefined,
      borderWidth: 0,
      borderRadius: radius.xl,
      backgroundColor: 'transparent',
      color: colors.fg,
      paddingTop: 10,
      paddingBottom: 8,
      paddingHorizontal: 8,
      textAlignVertical: 'top',
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.coral,
      shadowColor: colors.coral,
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    sendButtonDisabled: {
      backgroundColor: colors.coralSoft,
      shadowOpacity: 0,
      elevation: 0,
    },
    sendButtonBusy: {
      backgroundColor: colors.coral,
    },
    sendButtonPressed: {
      transform: [{ scale: 0.96 }],
    },
  });
}
