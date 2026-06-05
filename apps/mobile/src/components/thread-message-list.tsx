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
import { View } from 'react-native';
import {
  type MessageRole,
  authorInitials,
  displayAuthorName,
  formatMessageTime,
  messageAlignment,
  messageRole,
} from '../lib/thread-messages';

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
      {children}
    </MotiView>
  );
}

function avatarStyle(role: MessageRole, variant: 'admin' | 'resident') {
  if (role === 'resident') {
    return { bg: '#E7E5E4', fg: '#57534E' };
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
    return {
      bg: palette.messageResidentBg,
      border: palette.messageResidentBorder,
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
    bg: palette.messageMgmtSkyBg,
    border: palette.messageMgmtSkyBorder,
    borderWidth: 1,
    text: palette.messageMgmtSkyText,
    tail: 'left',
  };
}

function MessageBubble({
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
    <View
      style={{
        flexDirection: isRight ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <View
        style={{
          width: AVATAR,
          height: AVATAR,
          borderRadius: AVATAR / 2,
          backgroundColor: avatar.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="caption" style={{ color: avatar.fg, fontWeight: '700' }}>
          {initials}
        </AppText>
      </View>
      <View
        style={{
          flex: 1,
          maxWidth: '85%',
          alignItems: isRight ? 'flex-end' : 'flex-start',
          gap: 4,
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
            borderRadius: radius.lg,
            borderBottomRightRadius:
              bubble.tail === 'right' || (isRight && !bubble.tail) ? 4 : radius.lg,
            borderBottomLeftRadius:
              bubble.tail === 'left' || (!isRight && !bubble.tail) ? 4 : radius.lg,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: bubble.borderWidth,
            borderColor: bubble.border,
            width: '100%',
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
        </View>
      </View>
    </View>
  );
}

function SystemEventPill({ label, createdAt }: { label: string; createdAt: string }) {
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
          backgroundColor: '#F5F5F4',
          justifyContent: 'center',
        }}
      >
        <MetaLine parts={[label.toUpperCase(), formatMessageTime(createdAt)]} />
      </View>
    </View>
  );
}

export interface ThreadMessageListProps {
  messages: ThreadMessageItem[];
  variant: 'admin' | 'resident';
  viewerId?: string;
  residentId?: string;
  resolutionProposedMessageId?: string | null;
}

export function ThreadMessageList({
  messages,
  variant,
  viewerId,
  residentId,
  resolutionProposedMessageId,
}: ThreadMessageListProps) {
  const knownIds = React.useRef<Set<string>>(new Set());

  return (
    <View style={{ gap: 20 }}>
      {messages.map((m, index) => {
        if (m.kind === 'SYSTEM') {
          return (
            <MessageEnter key={m.id} id={m.id} index={index} knownIds={knownIds}>
              <SystemEventPill
                label={m.body.split(';')[0]?.trim() || 'Update'}
                createdAt={m.createdAt}
              />
            </MessageEnter>
          );
        }

        if (m.kind === 'INTERNAL_NOTE') {
          return (
            <MessageEnter key={m.id} id={m.id} index={index} knownIds={knownIds}>
              <View
                style={{
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderLeftWidth: 4,
                  borderColor: '#FCD34D66',
                  backgroundColor: '#FEF3C733',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <MetaLine
                  parts={[
                    'Internal note',
                    m.author?.name ?? 'Staff',
                    formatMessageTime(m.createdAt),
                  ]}
                />
                <AppText variant="bodySm" style={{ marginTop: 6 }}>
                  {m.body}
                </AppText>
              </View>
            </MessageEnter>
          );
        }

        const align = messageAlignment(m, { variant, viewerId, residentId });
        const role = messageRole(m, { residentId });
        const authorName = displayAuthorName(m, { variant, viewerId, residentId });
        const isProposed = resolutionProposedMessageId === m.id;

        return (
          <MessageEnter key={m.id} id={m.id} index={index} knownIds={knownIds}>
            <MessageBubble
              message={m}
              align={align}
              authorName={authorName}
              role={role}
              variant={variant}
              isProposed={isProposed}
            />
          </MessageEnter>
        );
      })}
    </View>
  );
}
