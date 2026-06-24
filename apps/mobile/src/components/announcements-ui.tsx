import type { Announcement, AnnouncementCategory } from '@smartresidence/shared-types';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  announcementExcerpt,
  isPdfMime,
} from '@smartresidence/shared-types';
import {
  AlignRow,
  AnimatedPressable,
  AppText,
  Card,
  MetaLine,
  Pill,
  palette,
  radius,
  spacing,
} from '@smartresidence/ui-mobile';
import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { RESIDENT_CORAL, residentStyles } from './resident-screen';

export const CATEGORY_OPTIONS = (
  Object.entries(ANNOUNCEMENT_CATEGORY_LABELS) as [AnnouncementCategory, string][]
).map(([value, label]) => ({ value, label }));

export function formatAnnouncementDate(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatAnnouncementDetailDate(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function UnreadDot({ unread }: { unread: boolean }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
        backgroundColor: unread ? RESIDENT_CORAL : 'transparent',
        borderWidth: unread ? 0 : 0,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

type CategoryFilterProps = {
  value: AnnouncementCategory | '';
  onChange: (value: AnnouncementCategory | '') => void;
};

export function AnnouncementCategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
    >
      <FilterTab label="All" active={value === ''} onPress={() => onChange('')} />
      {CATEGORY_OPTIONS.map((opt) => (
        <FilterTab
          key={opt.value}
          label={opt.label}
          active={value === opt.value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </ScrollView>
  );
}

function FilterTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radius.full,
        backgroundColor: active ? palette.coralPrimary : '#E5E7EB',
      }}
    >
      <AppText
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: active ? '#FFFFFF' : palette.textLight,
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function ImportanceBadge({ importance }: { importance: Announcement['importance'] }) {
  if (importance === 'URGENT') return <Pill tone="danger" label="Urgent" />;
  if (importance === 'IMPORTANT') return <Pill tone="warning" label="Important" />;
  return null;
}

export function AnnouncementListRow({ item }: { item: Announcement }) {
  const router = useRouter();
  const hasPdf = item.attachments?.some((a) => isPdfMime(a.mimeType));
  const isUnread = !item.readByMe;

  return (
    <AnimatedPressable onPress={() => router.push(`/(resident)/announcements/${item.id}` as Href)}>
      <Card style={[residentStyles.card, { padding: 16 }]}>
        <AlignRow style={{ alignItems: 'flex-start' }} gap={12}>
          <UnreadDot unread={isUnread} />
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
            <AlignRow style={{ flexWrap: 'wrap', alignItems: 'center' }} gap={6}>
              <AppText variant="label" numberOfLines={2} style={{ flexShrink: 1 }}>
                {item.title}
              </AppText>
              <Pill tone="neutral" label={ANNOUNCEMENT_CATEGORY_LABELS[item.category]} />
              {item.pinned ? <Pill tone="info" label="Pinned" /> : null}
              <ImportanceBadge importance={item.importance} />
            </AlignRow>
            <AppText variant="meta" numberOfLines={2} style={{ color: palette.mutedLight, lineHeight: 20 }}>
              {announcementExcerpt(item.body, 140)}
            </AppText>
            <MetaLine
              parts={[
                formatAnnouncementDate(item.publishedAt ?? item.createdAt),
                hasPdf ? (
                  <AlignRow key="pdf" gap={4}>
                    <Ionicons name="document-text-outline" size={14} color={RESIDENT_CORAL} />
                    <AppText variant="meta" style={{ color: RESIDENT_CORAL, fontWeight: '600' }}>
                      PDF memo
                    </AppText>
                  </AlignRow>
                ) : null,
                item.requiresAck && !item.ackedByMe ? (
                  <AppText key="ack" variant="meta" style={{ color: RESIDENT_CORAL, fontWeight: '600' }}>
                    Ack required
                  </AppText>
                ) : null,
              ]}
            />
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.mutedLight} style={{ marginTop: 4 }} />
        </AlignRow>
      </Card>
    </AnimatedPressable>
  );
}

export function AnnouncementHeroBadges({ item }: { item: Announcement }) {
  return (
    <AlignRow gap={8} style={{ flexWrap: 'wrap' }}>
      {item.pinned ? <Pill tone="info" label="Pinned" /> : null}
      <Pill tone="neutral" label={ANNOUNCEMENT_CATEGORY_LABELS[item.category]} />
      <ImportanceBadge importance={item.importance} />
    </AlignRow>
  );
}
