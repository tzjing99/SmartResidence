import type { ThreadMessageItem } from '@smartresidence/api-client';
import {
  AppText,
  MetaLine,
  palette,
  radius,
  spring,
  useReducedMotion,
} from '@smartresidence/ui-mobile';
import { MotiView } from 'moti';
import * as React from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {
  type MessageRole,
  authorInitials,
  displayAuthorName,
  formatMessageTime,
  messageAlignment,
  messageRole,
} from '../lib/thread-messages';
import { AuthImage } from './auth-image';

const AVATAR = 32;

function MessageEnter({
  id,
  index,
  knownIds,
  children,
}: {
  id: string;
  index: number;
  knownIds: React.MutableRefObject<Set<string>>;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const isKnown = knownIds.current.has(id);

  React.useLayoutEffect(() => {
    knownIds.current.add(id);
  }, [id, knownIds]);

  if (reduceMotion) {
    return <View>{children}</View>;
  }

  return (
    <MotiView
      from={isKnown ? undefined : { opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        ...spring.snappy,
        delay: isKnown ? 0 : Math.min(index, 6) * 35,
      }}
    >
      {children as never}
    </MotiView>
  );
}

function avatarStyle(role: MessageRole, variant: 'admin' | 'resident') {
  if (role === 'resident') {
    if (variant === 'resident') {
      return { bg: '#FFE2DF', fg: palette.coralPrimaryDark };
    }
    return { bg: '#F5F5F4', fg: '#57534E' };
  }
  if (variant === 'admin') {
    return { bg: '#FFE2DF', fg: palette.coralPrimary };
  }
  return { bg: '#E0F2FE', fg: '#0369A1' };
}

function bubbleStyle(
  role: MessageRole,
  align: 'left' | 'right',
  variant: 'admin' | 'resident',
  isProposed: boolean,
) {
  if (isProposed) {
    return {
      bg: palette.surfaceLight,
      border: '#0ea5e9',
      borderWidth: 1,
      borderLeftWidth: 4,
      text: palette.textLight,
    };
  }
  if (role === 'resident') {
    if (variant === 'resident' && align === 'right') {
      return {
        bg: '#FFF1F0',
        border: '#FFD1CB',
        borderWidth: 1,
        text: palette.textLight,
        tail: 'right',
      };
    }
    return {
      bg: '#FFFFFF',
      border: '#E7E5E4',
      borderWidth: 1,
      text: palette.textLight,
      tail: align === 'left' ? 'left' : 'right',
    };
  }
  if (variant === 'admin') {
    return {
      bg: palette.coralPrimary,
      border: palette.coralPrimary,
      borderWidth: 0,
      text: '#FFFFFF',
      tail: align === 'right' ? 'right' : 'left',
    };
  }
  return {
    bg: '#F0F9FF',
    border: '#BAE6FD',
    borderWidth: 1,
    text: '#0C4A6E',
    tail: 'left',
  };
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  align,
  authorName,
  role,
  variant,
  isProposed,
}: {
  message: ThreadMessageItem;
  align: 'left' | 'right';
  authorName: string;
  role: MessageRole;
  variant: 'admin' | 'resident';
  isProposed: boolean;
}) {
  const isRight = align === 'right';
  const initials = authorInitials(authorName === 'You' ? 'You' : message.author?.name);
  const avatar = avatarStyle(role, variant);
  const bubble = bubbleStyle(role, align, variant, isProposed);

  return (
    <View style={[styles.messageRow, { flexDirection: isRight ? 'row-reverse' : 'row' }]}>
      <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
        <AppText variant="caption" style={{ color: avatar.fg, fontWeight: '700' }}>
          {initials}
        </AppText>
      </View>
      <View
        style={{
          flexShrink: 1,
          maxWidth: '82%',
          alignItems: isRight ? 'flex-end' : 'flex-start',
          gap: 5,
        }}
      >
        <MetaLine
          parts={[authorName, formatMessageTime(message.createdAt)]}
          style={{ alignSelf: isRight ? 'flex-end' : 'flex-start' }}
        />
        <View
          style={{
            alignSelf: isRight ? 'flex-end' : 'flex-start',
            backgroundColor: bubble.bg,
            borderRadius: radius.xl,
            borderBottomRightRadius:
              bubble.tail === 'right' || (isRight && !bubble.tail) ? 6 : radius.xl,
            borderBottomLeftRadius:
              bubble.tail === 'left' || (!isRight && !bubble.tail) ? 6 : radius.xl,
            paddingHorizontal: 15,
            paddingVertical: 11,
            borderWidth: bubble.borderWidth,
            borderColor: bubble.border,
            shadowColor: '#1F2937',
            shadowOpacity: isProposed ? 0.06 : 0.03,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 1,
          }}
        >
          {isProposed ? (
            <AppText
              variant="caption"
              style={{
                color:
                  isProposed && role === 'management' && variant === 'admin'
                    ? '#FFFFFF'
                    : '#0369a1',
                fontWeight: '700',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Suggested fix
            </AppText>
          ) : null}
          <AppText variant="bodySm" style={{ color: bubble.text }}>
            {message.body}
          </AppText>
          {message.attachments && message.attachments.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {message.attachments
                .filter((a) => a.mimeType.startsWith('image/'))
                .map((a) => (
                  <AuthImage key={a.id} attachmentId={a.id} size={92} />
                ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const SystemEventPill = React.memo(function SystemEventPill({
  label,
  createdAt,
}: {
  label: string;
  createdAt: string;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          minHeight: 24,
          borderRadius: radius.full,
          backgroundColor: '#FFFFFFAA',
          borderWidth: 1,
          borderColor: '#F1E8E4',
          justifyContent: 'center',
        }}
      >
        <MetaLine parts={[label.toUpperCase(), formatMessageTime(createdAt)]} />
      </View>
    </View>
  );
});

function ThreadMessageRow({
  message,
  index,
  knownIds,
  variant,
  viewerId,
  residentId,
  resolutionProposedMessageId,
}: {
  message: ThreadMessageItem;
  index: number;
  knownIds: React.MutableRefObject<Set<string>>;
  variant: 'admin' | 'resident';
  viewerId?: string;
  residentId?: string;
  resolutionProposedMessageId?: string | null;
}) {
  if (message.kind === 'SYSTEM') {
    return (
      <MessageEnter key={message.id} id={message.id} index={index} knownIds={knownIds}>
        <SystemEventPill
          label={message.body.split(';')[0]?.trim() || 'Update'}
          createdAt={message.createdAt}
        />
      </MessageEnter>
    );
  }

  if (message.kind === 'INTERNAL_NOTE') {
    return (
      <MessageEnter key={message.id} id={message.id} index={index} knownIds={knownIds}>
        <View
          style={{
            borderRadius: radius.xl,
            borderWidth: 1,
            borderLeftWidth: 4,
            borderColor: '#FDE68A',
            backgroundColor: '#FFFBEB',
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <MetaLine
            parts={[
              'Internal note',
              message.author?.name ?? 'Staff',
              formatMessageTime(message.createdAt),
            ]}
          />
          <AppText variant="bodySm" style={{ marginTop: 6 }}>
            {message.body}
          </AppText>
        </View>
      </MessageEnter>
    );
  }

  const align = messageAlignment(message, { variant, viewerId, residentId });
  const role = messageRole(message, { residentId });
  const authorName = displayAuthorName(message, { variant, viewerId, residentId });
  const isProposed = resolutionProposedMessageId === message.id;

  return (
    <MessageEnter key={message.id} id={message.id} index={index} knownIds={knownIds}>
      <MessageBubble
        message={message}
        align={align}
        authorName={authorName}
        role={role}
        variant={variant}
        isProposed={isProposed}
      />
    </MessageEnter>
  );
}

export interface ThreadMessageListProps {
  messages: ThreadMessageItem[];
  variant: 'admin' | 'resident';
  viewerId?: string;
  residentId?: string;
  resolutionProposedMessageId?: string | null;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  ListHeaderComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
}

export function ThreadMessageList({
  messages,
  variant,
  viewerId,
  residentId,
  resolutionProposedMessageId,
  style,
  contentContainerStyle,
  ListHeaderComponent,
  ListFooterComponent,
}: ThreadMessageListProps) {
  const knownIds = React.useRef<Set<string>>(new Set());
  const keyExtractor = React.useCallback((message: ThreadMessageItem) => message.id, []);
  const renderItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<ThreadMessageItem>) => (
      <ThreadMessageRow
        message={item}
        index={index}
        knownIds={knownIds}
        variant={variant}
        viewerId={viewerId}
        residentId={residentId}
        resolutionProposedMessageId={resolutionProposedMessageId}
      />
    ),
    [residentId, resolutionProposedMessageId, variant, viewerId],
  );

  return (
    <FlatList
      data={messages}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      style={style}
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      initialNumToRender={14}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={24}
      windowSize={7}
      removeClippedSubviews={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    gap: 20,
  },
  messageRow: {
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
