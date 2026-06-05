import { palette } from '@smartresidence/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { PreRegForm, type PreRegPrefill } from '../../../src/components/pre-reg-form';
import { useTabletLayout } from '../../../src/lib/use-tablet-layout';

export default function NewVisitorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    phone?: string;
    phoneCountryCode?: string;
    vehiclePlate?: string;
    entryMode?: string;
  }>();
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();

  const prefill: PreRegPrefill = {
    name: params.name,
    phone: params.phone,
    phoneCountryCode: params.phoneCountryCode,
    vehiclePlate: params.vehiclePlate,
    entryMode:
      params.entryMode === 'DRIVE_IN' || params.entryMode === 'WALK_IN'
        ? params.entryMode
        : undefined,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{
        paddingVertical: 20,
        paddingBottom: 40,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Pre-register a visitor</Text>
      </View>
      <PreRegForm prefill={prefill} onSuccess={() => router.back()} />
    </ScrollView>
  );
}
