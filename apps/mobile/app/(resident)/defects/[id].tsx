import { Ionicons } from '@expo/vector-icons';
import { useAddDefectUpdate, useDefect, useTransitionDefect } from '@smartresidence/api-client';
import { DEFECT_SIGN_OFF_PROMPT_LABEL, type DefectStatus } from '@smartresidence/shared-types';
import {
  AnimatedPressable,
  AppText,
  Button,
  Card,
  Pill,
  Stack,
  radius,
  spacing,
  useTheme,
} from '@smartresidence/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { AuthImage } from '../../../src/components/auth-image';
import { PhotoPicker } from '../../../src/components/photo-picker';
import {
  ResidentScreen,
  prettyLabel,
  useResidentStyles,
} from '../../../src/components/resident-screen';
import { api } from '../../../src/lib/api';
import { confirmDefectSignOff } from '../../../src/lib/defect-sign-off';
import { usePhotoUpload } from '../../../src/lib/use-photo-upload';

type DefectUpdate = {
  id: string;
  message: string;
  statusFrom?: DefectStatus | null;
  statusTo?: DefectStatus | null;
  isInternal?: boolean;
  createdAt: string;
  author?: { name?: string | null } | null;
  attachments?: Array<{ id: string; fileName?: string | null }>;
};

type DefectDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  location?: string | null;
  status: DefectStatus;
  createdAt: string;
  assignedTo?: { name?: string | null } | null;
  attachments?: Array<{ id: string; fileName?: string | null }>;
  updates?: DefectUpdate[];
};

export default function DefectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const isDark = colors.statusBarStyle === 'light';
  const signOffCardStyle = useMemo(
    () => ({
      borderColor: isDark ? '#10B981' : '#A7F3D0',
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      gap: spacing.sm,
    }),
    [isDark],
  );
  const fieldStyle = useMemo(
    () => ({
      minHeight: 80,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      paddingTop: 10,
      fontSize: 14,
      color: colors.fg,
      textAlignVertical: 'top' as const,
    }),
    [colors],
  );
  const detail = useDefect(api, id ?? null);
  const addUpdate = useAddDefectUpdate(api);
  const transition = useTransitionDefect(api);
  const photo = usePhotoUpload();

  const [comment, setComment] = useState('');
  const d = detail.data as DefectDetail | undefined;

  async function submitComment() {
    if (!id || !comment.trim()) return;
    if (photo.uploading) {
      Alert.alert('Please wait', 'Photos are still uploading.');
      return;
    }
    try {
      await addUpdate.mutateAsync({
        id,
        message: comment.trim(),
        attachmentIds: photo.attachmentIds.length ? photo.attachmentIds : undefined,
      });
      setComment('');
      photo.reset();
      Alert.alert('Sent', 'Your comment was added.');
    } catch (err) {
      Alert.alert('Could not send', (err as Error).message);
    }
  }

  async function signOff(status: 'CLOSED' | 'REOPENED') {
    if (!id) return;
    const run = async () => {
      try {
        await transition.mutateAsync({ id, status });
        Alert.alert(
          status === 'CLOSED' ? 'Signed off' : 'Sent back',
          status === 'CLOSED' ? 'Defect signed off and closed.' : 'Defect sent back for more work.',
        );
      } catch (err) {
        Alert.alert('Could not update', (err as Error).message);
      }
    };
    if (status === 'CLOSED') {
      confirmDefectSignOff(run);
      return;
    }
    await run();
  }

  const visibleUpdates = (d?.updates ?? []).filter((u) => !u.isInternal);

  return (
    <ResidentScreen
      eyebrow="Defect"
      title={d?.title ?? 'Loading…'}
      subtitle={
        d
          ? `${d.category}${d.location ? ` · ${d.location}` : ''} · raised ${new Date(d.createdAt).toLocaleDateString()}`
          : undefined
      }
      headerAction={
        <AnimatedPressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.fg} />
        </AnimatedPressable>
      }
    >
      {detail.isLoading ? (
        <AppText variant="meta" style={{ color: colors.muted }}>
          Loading defect…
        </AppText>
      ) : !d ? (
        <AppText variant="meta" style={{ color: colors.muted }}>
          This defect could not be found.
        </AppText>
      ) : (
        <Stack gap={spacing.md}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Pill
              tone={
                d.status === 'CLOSED' || d.status === 'RESOLVED'
                  ? 'success'
                  : d.status === 'NEW'
                    ? 'primary'
                    : 'info'
              }
              label={d.status === 'RESOLVED' ? 'Waiting sign-off' : prettyLabel(d.status)}
            />
            {d.assignedTo?.name ? (
              <AppText variant="meta" style={{ color: colors.muted }}>
                Handled by {d.assignedTo.name}
              </AppText>
            ) : null}
          </View>

          {d.status === 'RESOLVED' ? (
            <Card style={[styles.card, signOffCardStyle]}>
              <AppText style={{ fontWeight: '600', color: isDark ? '#A7F3D0' : '#065F46' }}>
                Fixed by management — please verify
              </AppText>
              <AppText
                variant="meta"
                style={{ color: isDark ? '#6EE7B7' : '#047857', lineHeight: 18 }}
              >
                Accept if the repair is satisfactory, or send it back if more work is needed.
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button
                  title={transition.isPending ? 'Signing off…' : DEFECT_SIGN_OFF_PROMPT_LABEL}
                  size="sm"
                  loading={transition.isPending}
                  onPress={() => signOff('CLOSED')}
                  style={{ flexGrow: 1 }}
                />
                <Button
                  title="Reject — more work"
                  variant="secondary"
                  size="sm"
                  disabled={transition.isPending}
                  onPress={() => signOff('REOPENED')}
                  style={{ flexGrow: 1 }}
                />
              </View>
            </Card>
          ) : null}

          <Card style={[styles.card, { gap: spacing.sm }]}>
            <AppText variant="subheading">Description</AppText>
            <AppText style={{ color: colors.fg, lineHeight: 22 }}>{d.description}</AppText>
            {(d.attachments?.length ?? 0) > 0 ? (
              <View style={{ gap: spacing.sm, marginTop: 4 }}>
                <AppText variant="meta" style={{ color: colors.muted, fontWeight: '600' }}>
                  Photos
                </AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {d.attachments?.map((a) => (
                      <AuthImage key={a.id} attachmentId={a.id} variant="raw" size={120} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </Card>

          <Card style={[styles.card, { gap: spacing.sm }]}>
            <AppText variant="subheading">Activity</AppText>
            {visibleUpdates.length === 0 ? (
              <AppText variant="meta" style={{ color: colors.muted }}>
                No activity yet.
              </AppText>
            ) : (
              visibleUpdates.map((u) => (
                <View
                  key={u.id}
                  style={{
                    borderLeftWidth: 2,
                    borderLeftColor: u.statusTo ? colors.coral : colors.border,
                    paddingLeft: 10,
                    gap: 4,
                  }}
                >
                  <AppText variant="meta" style={{ color: colors.muted }}>
                    {u.author?.name ?? 'Someone'} ·{' '}
                    {new Date(u.createdAt).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </AppText>
                  {u.statusTo ? (
                    <AppText variant="meta" style={{ color: colors.coral, fontWeight: '600' }}>
                      Status → {prettyLabel(u.statusTo)}
                    </AppText>
                  ) : null}
                  <AppText style={{ color: colors.fg, lineHeight: 20 }}>{u.message}</AppText>
                  {(u.attachments?.length ?? 0) > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {u.attachments?.map((a) => (
                        <AuthImage key={a.id} attachmentId={a.id} size={72} />
                      ))}
                    </View>
                  ) : null}
                </View>
              ))
            )}

            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <TextInput
                placeholder="Add a comment for the management team…"
                placeholderTextColor={colors.muted}
                value={comment}
                onChangeText={setComment}
                multiline
                style={fieldStyle}
              />
              <PhotoPicker controller={photo} />
              <Button
                title={addUpdate.isPending ? 'Sending…' : 'Add comment'}
                size="sm"
                loading={addUpdate.isPending}
                disabled={!comment.trim() || photo.uploading}
                onPress={submitComment}
              />
            </View>
          </Card>
        </Stack>
      )}
    </ResidentScreen>
  );
}
