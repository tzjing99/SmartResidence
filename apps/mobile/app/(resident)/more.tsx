import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@smartresidence/api-client';
import { AppText, Card, spacing, useTheme } from '@smartresidence/ui-mobile';
import { type Href, useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  useResidentStyles,
} from '../../src/components/resident-screen';
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
  const styles = useResidentStyles();

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
      <View style={styles.iconBubble}>
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
  if (!role) return 'Resident';
  if (role === 'SECURITY_GUARD') return 'Guard';
  if (role === 'UNIT_OWNER' || role === 'OWNER') return 'Owner';
  if (role === 'TENANT') return 'Tenant';
  if (role === 'SUPER_ADMIN' || role === 'MANAGEMENT_ADMIN' || role === 'MANAGEMENT_STAFF')
    return 'Management';
  return 'Resident';
};

export default function MoreScreen() {
  const router = useRouter();
  const me = useMe(api);
  const user = (me.data as MeResponse | undefined)?.user;
  const { colors } = useTheme();
  const styles = useResidentStyles();

  return (
    <ResidentScreen
      eyebrow="More"
      title="Everything else"
      subtitle="Profile, activity history, and the rest of your resident tools."
    >
      <Pressable onPress={() => router.push('/(resident)/settings' as Href)}>
        <Card
          style={[
            styles.card,
            {
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            },
          ]}
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

      <ResidentSectionHeader
        title="Account"
        subtitle="Your profile, settings, and unit activity."
      />

      <Card style={[styles.card, { paddingVertical: 4 }]}>
        <MoreLink
          icon="time-outline"
          title="Activity"
          subtitle="Audit trail and who viewed your records"
          onPress={() => router.push('/(resident)/activity' as Href)}
        />
        <MoreLink
          icon="settings-outline"
          title="Settings"
          subtitle="Notifications, preferences, and sign out"
          onPress={() => router.push('/(resident)/settings' as Href)}
          isLast
        />
      </Card>

      <ResidentSectionHeader
        title="Resident tools"
        subtitle="Everything else your resident account can do."
      />

      <Card style={[styles.card, { paddingVertical: 4 }]}>
        <MoreLink
          icon="notifications-outline"
          title="Notifications"
          subtitle="Alerts, approvals, and updates"
          onPress={() => router.push('/(resident)/notifications' as Href)}
        />
        <MoreLink
          icon="podium-outline"
          title="MC polls"
          subtitle="Vote in owner consultations"
          onPress={() => router.push('/(resident)/polls' as Href)}
        />
        <MoreLink
          icon="calendar-outline"
          title="Facilities"
          subtitle="Book shared amenities"
          onPress={() => router.push('/(resident)/facilities' as Href)}
        />
        <MoreLink
          icon="document-text-outline"
          title="Documents"
          subtitle="House rules, minutes, and circulars"
          onPress={() => router.push('/(resident)/documents' as Href)}
        />
        <MoreLink
          icon="repeat-outline"
          title="Recurring visitor passes"
          subtitle="Repeat access for regular guests"
          onPress={() => router.push('/(resident)/visitors/recurring' as Href)}
        />
        <MoreLink
          icon="search-outline"
          title="Lost & found"
          subtitle="Community lost and found board"
          onPress={() => router.push('/(resident)/lost-found' as Href)}
        />
        <MoreLink
          icon="hammer-outline"
          title="Governance"
          subtitle="AGM, EGM, and owner meetings"
          onPress={() => router.push('/(resident)/governance' as Href)}
        />
        <MoreLink
          icon="clipboard-outline"
          title="Forms"
          subtitle="Move-in, renovation, and permits"
          onPress={() => router.push('/(resident)/forms' as Href)}
        />
        <MoreLink
          icon="help-circle-outline"
          title="Help & FAQ"
          subtitle="Answers from your management office"
          onPress={() => router.push('/(resident)/faq' as Href)}
        />
        <MoreLink
          icon="key-outline"
          title="Who has access to my unit"
          subtitle="Review and revoke delegated access"
          onPress={() => router.push('/(resident)/access' as Href)}
        />
        <MoreLink
          icon="alert-circle-outline"
          title="Emergency SOS"
          subtitle="Raise an urgent alert to security"
          onPress={() => router.push('/(resident)/sos' as Href)}
          isLast
        />
      </Card>
    </ResidentScreen>
  );
}
