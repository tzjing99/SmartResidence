import { ROLE_LABEL, type RoleId } from '@smartresidence/shared-types';
import { AppText, Button, Card, EmptyState, Pill, palette } from '@smartresidence/ui-mobile';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Alert, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  residentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { useT } from '../../src/i18n/locale-provider';
import { api } from '../../src/lib/api';

type DelegatedGrant = {
  id: string;
  roleId: string;
  unitId: string | null;
  expiresAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

function roleLabel(roleId: string): string {
  return ROLE_LABEL[roleId as RoleId] ?? roleId;
}

export default function AccessScreen() {
  const t = useT();
  const qc = useQueryClient();
  const grants = useQuery({
    queryKey: ['owner', 'delegated-access'],
    queryFn: () => api.delegatedAccess(),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeRoleAssignment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner', 'delegated-access'] }),
  });
  const { refreshControl } = usePullToRefresh(
    useCallback(() => grants.refetch().then(() => undefined), [grants]),
  );

  const items = (grants.data as DelegatedGrant[] | undefined) ?? [];

  function confirmRevoke(grant: DelegatedGrant) {
    Alert.alert(
      'Revoke access?',
      `Revoke ${grant.user.name}'s access immediately? Active sessions will be signed out.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke now',
          style: 'destructive',
          onPress: () => {
            void revoke
              .mutateAsync(grant.id)
              .catch((err) => Alert.alert('Could not revoke', (err as Error).message));
          },
        },
      ],
    );
  }

  return (
    <ResidentScreen
      eyebrow={t('nav.sections.account')}
      title={t('nav.screens.access')}
      subtitle="As the owner, you can revoke any delegated access at any time. Revoking signs the user out of every device immediately."
      scrollProps={{ refreshControl }}
    >
      <ResidentSectionHeader title="Delegated access" />

      {grants.isLoading ? (
        <Card style={residentStyles.card}>
          <AppText variant="meta" style={{ color: palette.mutedLight }}>
            Loading…
          </AppText>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          title="No delegated access"
          description="You haven't given anyone else access to your unit yet."
        />
      ) : (
        items.map((g) => (
          <Card key={g.id} style={[residentStyles.card, { gap: 10 }]}>
            <View style={{ gap: 4 }}>
              <AppText style={{ fontWeight: '700', color: palette.textLight }} numberOfLines={2}>
                {g.user.name}
              </AppText>
              <AppText variant="meta" style={{ color: palette.mutedLight }} numberOfLines={1}>
                {g.user.email}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pill tone="info" label={roleLabel(g.roleId)} />
              {g.expiresAt ? (
                <Pill
                  tone="warning"
                  label={`Expires ${new Date(g.expiresAt).toLocaleDateString()}`}
                />
              ) : (
                <Pill tone="neutral" label="No expiry" />
              )}
            </View>
            <Button
              title="Revoke now"
              variant="destructive"
              size="sm"
              disabled={revoke.isPending}
              onPress={() => confirmRevoke(g)}
            />
          </Card>
        ))
      )}
    </ResidentScreen>
  );
}
