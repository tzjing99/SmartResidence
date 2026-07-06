import { MotiView } from 'moti';
import { View, type ViewProps } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme';
import { radius, spring } from '../tokens';

export const Card = ({ style, children, ...props }: ViewProps) => {
  const reduceMotion = useReducedMotion();
  const { colors } = useTheme();
  return (
    <MotiView
      from={reduceMotion ? undefined : { opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={spring.default}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius['2xl'],
          padding: 20,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          shadowColor: '#000',
          shadowOpacity: colors.statusBarStyle === 'light' ? 0.08 : 0.25,
          shadowRadius: colors.statusBarStyle === 'light' ? 12 : 8,
          shadowOffset: { width: 0, height: colors.statusBarStyle === 'light' ? 4 : 2 },
          elevation: colors.statusBarStyle === 'light' ? 3 : 0,
        },
        style as object,
      ]}
      {...props}
    >
      {children}
    </MotiView>
  );
};

export const Stack = ({ style, children, ...props }: ViewProps & { gap?: number }) => {
  const gap = (props as { gap?: number }).gap ?? 12;
  return (
    <View style={[{ gap }, style as object]} {...props}>
      {children}
    </View>
  );
};
