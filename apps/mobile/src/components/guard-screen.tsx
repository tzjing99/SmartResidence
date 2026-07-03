import { useMyCondos } from '@smartresidence/api-client';
import {
  AppText,
  type ThemeColors,
  palette,
  radius,
  spacing,
  useTheme,
} from '@smartresidence/ui-mobile';
import { type ReactNode, useMemo } from 'react';
import {
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useTabletLayout } from '../lib/use-tablet-layout';

export const GUARD_CORAL = '#FF5A5F';
export const GUARD_SKY = '#0EA5E9';
export const GUARD_SOFT_CORAL = '#FFF1F0';
export const GUARD_SOFT_SKY = '#F0F9FF';
export const GUARD_WARM_BG = '#FFF8F6';
export const GUARD_CARD_BORDER = '#F1E8E4';

type GuardScreenProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerAction?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'style' | 'contentContainerStyle'>;
};

export function GuardScreen({
  eyebrow,
  title,
  subtitle,
  children,
  headerAction,
  contentStyle,
  scrollProps,
}: GuardScreenProps) {
  const insets = useSafeAreaInsets();
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();
  const { colors } = useTheme();
  const styles = useMemo(() => createGuardStyles(colors), [colors]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.max(insets.top + 24, 36),
          paddingBottom: Math.max(insets.bottom, 16) + 96,
        },
      ]}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      <View
        style={[
          styles.content,
          {
            maxWidth: contentMaxWidth,
            paddingHorizontal: horizontalPadding,
          },
          contentStyle,
        ]}
      >
        <GuardHeader eyebrow={eyebrow} title={title} subtitle={subtitle} action={headerAction} />
        {children}
      </View>
    </ScrollView>
  );
}

export function GuardBrandBar() {
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const { colors } = useTheme();
  const styles = useMemo(() => createGuardStyles(colors), [colors]);

  return (
    <View style={styles.brandBar} accessibilityRole="header" accessibilityLabel="SmartResidence Gate">
      <View style={styles.brandLine}>
        <AppText style={styles.brandWord}>Smart</AppText>
        <AppText style={[styles.brandWord, styles.brandCoral]}>Residence</AppText>
        <AppText style={styles.brandDot}> · </AppText>
        <AppText style={styles.brandGate}>Gate</AppText>
      </View>
      {condo?.name ? (
        <AppText variant="meta" numberOfLines={1} style={styles.brandCondo}>
          {condo.name}
        </AppText>
      ) : null}
    </View>
  );
}

export function GuardHeader({
  eyebrow,
  title,
  subtitle,
  action,
  showBrand = true,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  showBrand?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createGuardStyles(colors), [colors]);

  return (
    <View style={styles.header}>
      {showBrand ? <GuardBrandBar /> : null}
      <View style={styles.headerCopy}>
        <AppText variant="caption" style={styles.eyebrow}>
          {eyebrow}
        </AppText>
        <AppText accessibilityRole="header" numberOfLines={2} style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText numberOfLines={4} style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function GuardSectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createGuardStyles(colors), [colors]);

  return (
    <View style={styles.sectionHeader}>
      <AppText variant="subheading" numberOfLines={2} style={styles.sectionTitle}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="meta" style={styles.sectionCopy}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function plainLabel(value: string | null | undefined) {
  if (!value) return '';
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createGuardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      alignItems: 'center',
    },
    content: {
      width: '100%',
      gap: spacing.md,
    },
    brandBar: {
      gap: 2,
      minWidth: 0,
    },
    brandLine: {
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
    },
    brandWord: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: colors.fg,
    },
    brandCoral: {
      color: colors.coral,
    },
    brandDot: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '400',
      color: colors.muted,
      opacity: 0.45,
    },
    brandGate: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: colors.fg,
    },
    brandCondo: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 16,
    },
    header: {
      gap: spacing.md,
    },
    headerCopy: {
      gap: 8,
      minWidth: 0,
    },
    headerAction: {
      width: '100%',
    },
    eyebrow: {
      color: colors.coral,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.fg,
      fontSize: 30,
      lineHeight: 38,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
    },
    sectionHeader: {
      gap: 3,
      marginTop: spacing.xs,
    },
    sectionTitle: {
      color: colors.fg,
    },
    sectionCopy: {
      color: colors.muted,
      lineHeight: 20,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    softCard: {
      borderRadius: radius['2xl'],
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    insetPanel: {
      borderRadius: radius.xl,
      backgroundColor: colors.messageResidentBg,
      padding: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    wrapRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    iconBubble: {
      width: 42,
      height: 42,
      borderRadius: radius.full,
      backgroundColor: colors.coralSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export const guardStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GUARD_WARM_BG,
  },
  scrollContent: {
    alignItems: 'center',
  },
  content: {
    width: '100%',
    gap: spacing.md,
  },
  brandBar: {
    gap: 2,
    minWidth: 0,
  },
  brandLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  brandWord: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: palette.textLight,
  },
  brandCoral: {
    color: GUARD_CORAL,
  },
  brandDot: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '400',
    color: palette.mutedLight,
    opacity: 0.45,
  },
  brandGate: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: palette.textLight,
  },
  brandCondo: {
    color: palette.mutedLight,
    fontSize: 12,
    lineHeight: 16,
  },
  header: {
    gap: spacing.md,
  },
  headerCopy: {
    gap: 8,
    minWidth: 0,
  },
  headerAction: {
    width: '100%',
  },
  eyebrow: {
    color: GUARD_CORAL,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.textLight,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: palette.mutedLight,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  sectionHeader: {
    gap: 3,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: palette.textLight,
  },
  sectionCopy: {
    color: palette.mutedLight,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: GUARD_CARD_BORDER,
  },
  softCard: {
    borderRadius: radius['2xl'],
    backgroundColor: palette.surfaceLight,
    borderWidth: 1,
    borderColor: GUARD_CARD_BORDER,
  },
  insetPanel: {
    borderRadius: radius.xl,
    backgroundColor: palette.bgLight,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
