import {
  DEFECT_SEVERITY_LABELS,
  DEFECT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  VISITOR_STATUS_LABELS,
} from '@smartresidence/shared-types';
import { AppText, type ThemeColors, spacing, useTheme } from '@smartresidence/ui-mobile';
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
import { useTabletLayout } from '../lib/use-tablet-layout';

/** @deprecated Use `useTheme().colors.coral` instead. */
export const RESIDENT_CORAL = '#FF5A5F';

export function useResidentColors(): ThemeColors {
  return useTheme().colors;
}

/** Theme-aware resident layout styles — prefer over deprecated `residentStyles`. */
export function useResidentStyles() {
  const { colors } = useTheme();
  return useMemo(() => createResidentStyles(colors), [colors]);
}

/** @deprecated Use `useTheme().colors.coralSoft` instead. */
export const RESIDENT_SOFT_CORAL = '#FFF1F0';
/** @deprecated Use `useTheme().colors.bg` instead. */
export const RESIDENT_WARM_BG = '#FFF8F6';
/** @deprecated Use `useTheme().colors.cardBorder` instead. */
export const RESIDENT_CARD_BORDER = '#F1E8E4';

type ResidentScreenProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerAction?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'style' | 'contentContainerStyle'>;
};

export function ResidentScreen({
  eyebrow,
  title,
  subtitle,
  children,
  headerAction,
  contentStyle,
  scrollProps,
}: ResidentScreenProps) {
  const insets = useSafeAreaInsets();
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();
  const { colors } = useTheme();
  const styles = useMemo(() => createResidentStyles(colors), [colors]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.max(insets.top + 24, 36),
          paddingBottom: Math.max(insets.bottom, 16) + 84,
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
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <AppText variant="caption" style={styles.eyebrow}>
              {eyebrow}
            </AppText>
            <AppText numberOfLines={2} style={styles.title}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText numberOfLines={3} style={styles.subtitle}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

export function ResidentSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createResidentStyles(colors), [colors]);

  return (
    <View style={styles.sectionHeader}>
      <AppText variant="subheading" numberOfLines={2}>
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

const PRETTY_LABEL_MAP: Record<string, string> = {
  ...INVOICE_STATUS_LABELS,
  ...PAYMENT_STATUS_LABELS,
  ...VISITOR_STATUS_LABELS,
  ...DEFECT_STATUS_LABELS,
  ...DEFECT_SEVERITY_LABELS,
};

export function prettyLabel(value: string | null | undefined): string {
  if (!value) return '';
  const mapped = PRETTY_LABEL_MAP[value];
  if (mapped) return mapped;
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createResidentStyles(colors: ThemeColors) {
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
      fontWeight: '700',
      letterSpacing: 0.4,
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
      gap: 2,
      marginTop: spacing.xs,
    },
    sectionCopy: {
      color: colors.muted,
      lineHeight: 20,
    },
    /** Border is applied by `Card`; keep empty so style merges do not override theme borders. */
    card: {},
    softCard: {
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    insetPanel: {
      borderRadius: 12,
      backgroundColor: colors.messageResidentBg,
      padding: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 9999,
      backgroundColor: colors.coralSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

/** @deprecated Prefer `useResidentColors()` + local styles for theme-aware screens. */
export const residentStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RESIDENT_WARM_BG,
  },
  scrollContent: {
    alignItems: 'center',
  },
  content: {
    width: '100%',
    gap: spacing.md,
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
    color: RESIDENT_CORAL,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  sectionHeader: {
    gap: 2,
    marginTop: spacing.xs,
  },
  sectionCopy: {
    color: '#6B7280',
    lineHeight: 20,
  },
  /** @deprecated Border lives on `Card` — use `useResidentStyles().card` (empty) for spacing only. */
  card: {},
  softCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: RESIDENT_CARD_BORDER,
  },
  insetPanel: {
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: RESIDENT_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
