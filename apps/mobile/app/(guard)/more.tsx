import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@smartresidence/api-client';
import { AppText, Card, spacing, useTheme } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { GuardScreen, GuardSectionHeader } from '../../src/components/guard-screen';
import { useT } from '../../src/i18n/locale-provider';
import { api } from '../../src/lib/api';
import type { MeResponse } from '../../src/lib/roles';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function MoreLink({
  icon,
  title,
  subtitle,
  onPress,
  isLast,
}: {
  icon: IoniconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 9999,
          backgroundColor: colors.coralSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={20} color={colors.coral} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={{ fontWeight: '700', color: colors.fg }} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="meta" style={{ color: colors.muted }} numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const mapRoleLabel = (role: string | null | undefined): string => {
  if (role === 'SECURITY_GUARD') return 'Guard';
  if (role === 'UNIT_OWNER' || role === 'OWNER') return 'Owner';
  if (role === 'TENANT') return 'Tenant';
  if (role === 'SUPER_ADMIN' || role === 'MANAGEMENT_ADMIN' || role === 'MANAGEMENT_STAFF')
    return 'Management';
  return 'Guard';
};

export default function GuardMoreScreen() {
  const router = useRouter();
  const t = useT();
  const me = useMe(api);
  const user = (me.data as MeResponse | undefined)?.user;
  const { colors } = useTheme();

  return (
    <GuardScreen
      eyebrow="More"
      title="Guard tools"
      subtitle="Patrol logs, manual entry, parcels, and account — everything beyond the daily gate flow."
    >
      <Pressable onPress={() => router.push('/(guard)/settings' as Href)}>
        <Card
          style={{
            borderWidth: 1,
            borderColor: colors.cardBorder,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.coral,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <AppText style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </AppText>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText
              style={{ fontSize: 16, fontWeight: '700', color: colors.fg }}
              numberOfLines={2}
            >
              {user?.name ?? 'Loading...'}
            </AppText>
            {user?.email ? (
              <AppText style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>
                {user.email}
              </AppText>
            ) : null}
            <View style={{ flexDirection: 'row', marginTop: 2 }}>
              <View
                style={{
                  backgroundColor: colors.messageMgmtCoralBg,
                  borderColor: colors.messageMgmtCoralBorder,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <AppText
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: colors.coral,
                  }}
                >
                  {mapRoleLabel(user?.activeRole)}
                </AppText>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      </Pressable>

      <GuardSectionHeader
        title="Gate operations"
        subtitle="Secondary check-in and security actions."
      />

      <Card style={{ borderWidth: 1, borderColor: colors.cardBorder, paddingVertical: 4 }}>
        <MoreLink
          icon="shield-checkmark-outline"
          title={t('mobile.guard.tabs.patrol')}
          subtitle="Log patrol rounds and checkpoints"
          onPress={() => router.push('/(guard)/patrol' as Href)}
        />
        <MoreLink
          icon="alert-circle-outline"
          title={t('mobile.guard.tabs.alerts')}
          subtitle="Incidents and security notifications"
          onPress={() => router.push('/(guard)/alerts' as Href)}
        />
        <MoreLink
          icon="create-outline"
          title={t('mobile.guard.tabs.manual')}
          subtitle="Manual check-in when scanning is unavailable"
          onPress={() => router.push('/(guard)/manual' as Href)}
        />
        <MoreLink
          icon="cube-outline"
          title={t('mobile.guard.tabs.parcels')}
          subtitle="Log and hand over deliveries"
          onPress={() => router.push('/(guard)/parcels' as Href)}
          isLast
        />
      </Card>

      <GuardSectionHeader title="Account" subtitle="Signed-in guard account and shift settings." />

      <Card style={{ borderWidth: 1, borderColor: colors.cardBorder, paddingVertical: 4 }}>
        <MoreLink
          icon="settings-outline"
          title={t('mobile.guard.tabs.settings')}
          subtitle="Account, shift, and sign out"
          onPress={() => router.push('/(guard)/settings' as Href)}
          isLast
        />
      </Card>
    </GuardScreen>
  );
}
