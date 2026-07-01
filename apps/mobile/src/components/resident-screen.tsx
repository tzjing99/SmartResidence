import {
  DEFECT_SEVERITY_LABELS,
  DEFECT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  VISITOR_STATUS_LABELS,
} from '@smartresidence/shared-types';
import { AppText, palette, radius, spacing } from '@smartresidence/ui-mobile';
import { type ReactNode } from 'react';
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

export const RESIDENT_CORAL = palette.coralPrimary;
export const RESIDENT_SOFT_CORAL = '#FFF1F0';
export const RESIDENT_WARM_BG = '#FFF8F6';
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

  return (
    <ScrollView
      style={residentStyles.screen}
      contentContainerStyle={[
        residentStyles.scrollContent,
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
          residentStyles.content,
          {
            maxWidth: contentMaxWidth,
            paddingHorizontal: horizontalPadding,
          },
          contentStyle,
        ]}
      >
        <View style={residentStyles.header}>
          <View style={residentStyles.headerCopy}>
            <AppText variant="caption" style={residentStyles.eyebrow}>
              {eyebrow}
            </AppText>
            <AppText numberOfLines={2} style={residentStyles.title}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText numberOfLines={3} style={residentStyles.subtitle}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {headerAction ? <View style={residentStyles.headerAction}>{headerAction}</View> : null}
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
  return (
    <View style={residentStyles.sectionHeader}>
      <AppText variant="subheading" numberOfLines={2}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="meta" style={residentStyles.sectionCopy}>
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
    gap: 2,
    marginTop: spacing.xs,
  },
  sectionCopy: {
    color: palette.mutedLight,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: RESIDENT_CARD_BORDER,
  },
  softCard: {
    borderRadius: radius['2xl'],
    backgroundColor: palette.surfaceLight,
    borderWidth: 1,
    borderColor: RESIDENT_CARD_BORDER,
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
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: RESIDENT_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
