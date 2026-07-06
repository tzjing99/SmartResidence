import {
  useCondoLostFoundPosts,
  useCreateLostFoundPost,
  useMyCondos,
  useMyLostFoundPosts,
  useMyUnits,
  useRemoveLostFoundPost,
  useResolveLostFoundPost,
} from '@smartresidence/api-client';
import type { LostFoundKind, LostFoundPost, LostFoundStatus } from '@smartresidence/shared-types';
import { LOST_FOUND_KIND_LABELS, LOST_FOUND_STATUS_LABELS } from '@smartresidence/shared-types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Pill,
  radius,
  useTheme,
} from '@smartresidence/ui-mobile';
import { useCallback, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';

const KIND_TONE: Record<LostFoundKind, 'warning' | 'success'> = {
  LOST: 'warning',
  FOUND: 'success',
};

const STATUS_TONE: Record<LostFoundStatus, 'neutral' | 'success' | 'warning'> = {
  OPEN: 'warning',
  RESOLVED: 'success',
  REMOVED: 'neutral',
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function unitLabel(post: LostFoundPost) {
  const block = post.unit?.block?.name;
  const id = post.unit?.identifier;
  if (block && id) return `${block} · ${id}`;
  return id ?? '—';
}

function FormField({
  label,
  value,
  onChangeText,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.inputBg,
          color: colors.fg,
          minHeight: multiline ? 88 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
        multiline={multiline}
      />
    </View>
  );
}

function PostRow({
  post,
  mine,
  onResolve,
  onRemove,
}: {
  post: LostFoundPost;
  mine?: boolean;
  onResolve?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Pill tone={KIND_TONE[post.kind]} label={LOST_FOUND_KIND_LABELS[post.kind]} />
        <Pill tone={STATUS_TONE[post.status]} label={LOST_FOUND_STATUS_LABELS[post.status]} />
      </View>
      <AppText style={{ fontWeight: '700', color: colors.fg }}>{post.title}</AppText>
      <AppText variant="meta" style={{ color: colors.muted }}>
        {unitLabel(post)}
        {post.user?.name ? ` · ${post.user.name}` : ''} · {fmtDate(post.createdAt)}
      </AppText>
      <AppText style={{ color: colors.fg }}>{post.description}</AppText>
      {post.locationNote ? <AppText variant="meta">Where: {post.locationNote}</AppText> : null}
      <AppText variant="meta">Contact: {post.contactMethod}</AppText>
      {mine && post.status === 'OPEN' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <Button title="Mark resolved" size="sm" onPress={() => onResolve?.(post.id)} />
          <Button
            title="Remove post"
            size="sm"
            variant="secondary"
            onPress={() => onRemove?.(post.id)}
          />
        </View>
      ) : null}
    </Card>
  );
}

export default function LostFoundScreen() {
  const { colors } = useTheme();
  const condos = useMyCondos(api);
  const units = useMyUnits(api);
  const condo = condos.data?.[0];
  const unit = units.data?.[0] as { id: string } | undefined;

  const [tab, setTab] = useState<'board' | 'mine' | 'new'>('board');
  const [kindFilter, setKindFilter] = useState<'ALL' | LostFoundKind>('ALL');

  const boardQuery = useCondoLostFoundPosts(api, condo?.id ?? null, {
    openOnly: true,
    kind: kindFilter === 'ALL' ? undefined : kindFilter,
  });
  const mineQuery = useMyLostFoundPosts(api);
  const createPost = useCreateLostFoundPost(api);
  const resolvePost = useResolveLostFoundPost(api);
  const removePost = useRemoveLostFoundPost(api);

  const refetchAll = useCallback(async () => {
    await Promise.all([boardQuery.refetch(), mineQuery.refetch()]);
  }, [boardQuery, mineQuery]);
  const { refreshControl } = usePullToRefresh(refetchAll);

  const [kind, setKind] = useState<LostFoundKind>('LOST');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [contactMethod, setContactMethod] = useState('');

  function confirmResolve(id: string) {
    Alert.alert('Mark resolved?', 'This tells neighbours the item was reunited or closed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: () => {
          void resolvePost
            .mutateAsync(id)
            .catch((err: Error) => Alert.alert('Could not update', err.message));
        },
      },
    ]);
  }

  function confirmRemove(id: string) {
    Alert.alert('Remove post?', 'Your post will disappear from the community board.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removePost
            .mutateAsync(id)
            .catch((err: Error) => Alert.alert('Could not remove', err.message));
        },
      },
    ]);
  }

  async function submitPost() {
    if (!condo?.id || !unit?.id) return;
    try {
      await createPost.mutateAsync({
        condoId: condo.id,
        unitId: unit.id,
        kind,
        title,
        description,
        locationNote: locationNote.trim() || undefined,
        contactMethod,
      });
      Alert.alert('Posted', 'Your item is on the community board.');
      setTitle('');
      setDescription('');
      setLocationNote('');
      setContactMethod('');
      setTab('mine');
    } catch (err) {
      Alert.alert('Could not post', err instanceof Error ? err.message : 'Try again');
    }
  }

  const boardPosts = boardQuery.data?.items ?? [];
  const myPosts = mineQuery.data?.items ?? [];

  return (
    <ResidentScreen
      eyebrow="Community"
      title="Lost & found"
      subtitle="Help neighbours reunite with lost items — not for buying or selling."
      scrollProps={{ refreshControl }}
    >
      <View style={[residentStyles.row, { gap: 8, flexWrap: 'wrap', marginBottom: 16 }]}>
        {(['board', 'mine', 'new'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: radius.full,
              backgroundColor: tab === t ? colors.coral : colors.coralSoft,
            }}
          >
            <AppText
              variant="meta"
              style={{ fontWeight: '600', color: tab === t ? '#fff' : colors.fg }}
            >
              {t === 'board' ? 'Board' : t === 'mine' ? 'My posts' : 'New post'}
            </AppText>
          </Pressable>
        ))}
      </View>

      {tab === 'new' ? (
        <Card style={{ padding: 16, gap: 12 }}>
          <ResidentSectionHeader title="Post to the board" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['LOST', 'FOUND'] as const).map((k) => (
              <Pressable key={k} onPress={() => setKind(k)}>
                <Pill
                  tone={kind === k ? KIND_TONE[k] : 'neutral'}
                  label={k === 'LOST' ? 'I lost something' : 'I found something'}
                />
              </Pressable>
            ))}
          </View>
          <FormField label="Short title" value={title} onChangeText={setTitle} />
          <FormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <FormField
            label="Location note (optional)"
            value={locationNote}
            onChangeText={setLocationNote}
          />
          <FormField
            label="How can someone reach you?"
            value={contactMethod}
            onChangeText={setContactMethod}
          />
          <Button
            title="Post to board"
            onPress={() => void submitPost()}
            loading={createPost.isPending}
          />
        </Card>
      ) : null}

      {tab === 'board' ? (
        <>
          <View style={[residentStyles.row, { gap: 8, flexWrap: 'wrap', marginBottom: 12 }]}>
            {(['ALL', 'LOST', 'FOUND'] as const).map((f) => (
              <Pressable key={f} onPress={() => setKindFilter(f)}>
                <Pill tone="neutral" label={f === 'ALL' ? 'All open' : LOST_FOUND_KIND_LABELS[f]} />
              </Pressable>
            ))}
          </View>
          {boardQuery.isLoading ? (
            <AppText style={{ color: colors.muted }}>Loading board…</AppText>
          ) : boardPosts.length === 0 ? (
            <EmptyState
              title="Nothing on the board"
              description="Open lost and found posts will appear here."
            />
          ) : (
            <View style={{ gap: 12 }}>
              {boardPosts.map((post) => (
                <PostRow key={post.id} post={post} />
              ))}
            </View>
          )}
        </>
      ) : null}

      {tab === 'mine' ? (
        mineQuery.isLoading ? (
          <AppText style={{ color: colors.muted }}>Loading your posts…</AppText>
        ) : myPosts.length === 0 ? (
          <EmptyState title="No posts yet" description="Tap New post to add one." />
        ) : (
          <View style={{ gap: 12 }}>
            {myPosts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                mine
                onResolve={confirmResolve}
                onRemove={confirmRemove}
              />
            ))}
          </View>
        )
      ) : null}
    </ResidentScreen>
  );
}
