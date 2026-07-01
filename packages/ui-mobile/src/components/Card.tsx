import { MotiView } from 'moti';
import { View, type ViewProps } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { palette, radius, spring } from '../tokens';

export const Card = ({ style, children, ...props }: ViewProps) => {
  const reduceMotion = useReducedMotion();
  return (
    <MotiView
      from={reduceMotion ? undefined : { opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={spring.default}
      style={[
        {
          backgroundColor: palette.surfaceLight,
          borderRadius: radius['2xl'],
          padding: 20,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
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
