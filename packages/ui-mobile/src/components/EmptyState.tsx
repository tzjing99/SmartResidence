import { MotiView } from 'moti';
import type * as React from 'react';
import { Text, View } from 'react-native';
import { palette, radius, spring } from '../tokens';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action }) => (
  <MotiView
    from={{ opacity: 0, translateY: 12 }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={spring.gentle}
    style={{
      borderRadius: radius['2xl'],
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: palette.borderLight,
      padding: 32,
      alignItems: 'center',
      gap: 12,
    }}
    children={
      <>
        {icon ? <View>{icon}</View> : null}
        <Text style={{ fontSize: 17, fontWeight: '600', color: palette.textLight }}>{title}</Text>
        {description ? (
          <Text
            style={{ textAlign: 'center', color: palette.mutedLight, fontSize: 14, lineHeight: 20 }}
          >
            {description}
          </Text>
        ) : null}
        {action}
      </> as never
    }
  />
);
