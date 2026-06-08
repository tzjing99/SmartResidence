import { palette, radius } from '@smartresidence/ui-mobile';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import type { UsePhotoUpload } from '../lib/use-photo-upload';

/**
 * Reusable photo picker grid for mobile. Drive it with the `usePhotoUpload`
 * hook so it can be reused across messaging, defects, visitor flows, etc.
 */
export function PhotoPicker({ controller }: { controller: UsePhotoUpload }) {
  const { items, atLimit, pickFromLibrary, takePhoto, remove, retry } = controller;

  function onAdd() {
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => void takePhoto() },
      { text: 'Choose from library', onPress: () => void pickFromLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((item) => (
          <View
            key={item.id}
            style={{
              width: 84,
              height: 84,
              borderRadius: radius.md,
              overflow: 'hidden',
              backgroundColor: palette.borderLight,
            }}
          >
            <Image
              source={{ uri: item.uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />

            {item.status === 'uploading' ? (
              <View style={overlayStyle}>
                <ActivityIndicator color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 2 }}>
                  {Math.round(item.progress * 100)}%
                </Text>
              </View>
            ) : null}

            {item.status === 'error' ? (
              <Pressable
                onPress={() => retry(item.id)}
                style={[overlayStyle, { backgroundColor: 'rgba(220,38,38,0.7)' }]}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Retry</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => remove(item.id)}
              hitSlop={8}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: 'rgba(0,0,0,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, lineHeight: 16 }}>×</Text>
            </Pressable>
          </View>
        ))}

        {!atLimit ? (
          <Pressable
            onPress={onAdd}
            style={{
              width: 84,
              height: 84,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: palette.borderLight,
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <Text style={{ fontSize: 22, color: palette.coralPrimary, lineHeight: 24 }}>＋</Text>
            <Text style={{ fontSize: 11, color: palette.mutedLight }}>Add photo</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const overlayStyle = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: 'rgba(0,0,0,0.4)',
};
