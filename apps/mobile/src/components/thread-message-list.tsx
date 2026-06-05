import type { ThreadMessageItem } from '@smartresidence/api-client';
import { AppText, MetaLine, palette, radius } from '@smartresidence/ui-mobile';
import { View } from 'react-native';
import {
  authorInitials,
  displayAuthorName,
  formatMessageTime,
  messageAlignment,
} from '../lib/thread-messages';

const AVATAR = 32;

function MessageBubble({
  message,
  align,
  authorName,
  isProposed,
}: {
  message: ThreadMessageItem;
  align: 'left' | 'right';
  authorName: string;
  isProposed: boolean;
}) {
  const isRight = align === 'right';
  const initials = authorInitials(authorName === 'You' ? 'You' : message.author?.name);

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
          backgroundColor: isRight ? '#FFE2DF' : '#F3F4F6',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText
          variant="caption"
          style={{ color: isRight ? palette.coralPrimary : palette.mutedLight, fontWeight: '700' }}
        >
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
            backgroundColor: isRight ? palette.coralPrimary : palette.surfaceLight,
            borderRadius: radius.lg,
            borderBottomRightRadius: isRight ? 4 : radius.lg,
            borderBottomLeftRadius: isRight ? radius.lg : 4,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: isProposed ? 2 : 0,
            borderColor: '#0ea5e9',
            width: '100%',
          }}
        >
          {isProposed ? (
            <AppText
              variant="caption"
              style={{
                color: isRight ? 'rgba(255,255,255,0.85)' : '#0369a1',
                fontWeight: '700',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Suggested fix
            </AppText>
          ) : null}
          <AppText variant="bodySm" style={{ color: isRight ? '#FFFFFF' : palette.textLight }}>
            {message.body}
          </AppText>
        </View>
      </View>
    </View>
  );
}

function SystemEventPill({ label, createdAt }: { label: string; createdAt: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          minHeight: 24,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: `${palette.borderLight}80`,
          backgroundColor: `${palette.borderLight}26`,
          justifyContent: 'center',
        }}
      >
        <MetaLine parts={[label, formatMessageTime(createdAt)]} />
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
  return (
    <View style={{ gap: 16 }}>
      {messages.map((m) => {
        if (m.kind === 'SYSTEM') {
          return (
            <SystemEventPill
              key={m.id}
              label={m.body.split(';')[0]?.trim() || 'Update'}
              createdAt={m.createdAt}
            />
          );
        }

        if (m.kind === 'INTERNAL_NOTE') {
          return (
            <View
              key={m.id}
              style={{
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: '#FCD34D66',
                backgroundColor: '#FEF3C733',
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <MetaLine
                parts={['Internal note', m.author?.name ?? 'Staff', formatMessageTime(m.createdAt)]}
              />
              <AppText variant="bodySm" style={{ marginTop: 6 }}>
                {m.body}
              </AppText>
            </View>
          );
        }

        const align = messageAlignment(m, { variant, viewerId, residentId });
        const authorName = displayAuthorName(m, { variant, viewerId, residentId });
        const isProposed = resolutionProposedMessageId === m.id;

        return (
          <MessageBubble
            key={m.id}
            message={m}
            align={align}
            authorName={authorName}
            isProposed={isProposed}
          />
        );
      })}
    </View>
  );
}
