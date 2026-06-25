import { type VisitorEntryMode, VisitorPurpose } from '@smartresidence/shared-types';
import { palette } from '@smartresidence/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { PreRegForm, type PreRegPrefill } from '../../../src/components/pre-reg-form';
import { useTabletLayout } from '../../../src/lib/use-tablet-layout';

function paramString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function NewVisitorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string | string[];
    phone?: string | string[];
    phoneCountryCode?: string | string[];
    vehiclePlate?: string | string[];
    entryMode?: string | string[];
    purpose?: string | string[];
    expectedAt?: string | string[];
  }>();
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();

  const entryModeRaw = paramString(params.entryMode);
  const purposeRaw = paramString(params.purpose);
  const parsedPurpose = purposeRaw ? VisitorPurpose.safeParse(purposeRaw) : null;
  const prefill = useMemo<PreRegPrefill>(
    () => ({
      name: paramString(params.name),
      phone: paramString(params.phone),
      phoneCountryCode: paramString(params.phoneCountryCode),
      vehiclePlate: paramString(params.vehiclePlate),
      entryMode:
        entryModeRaw === 'DRIVE_IN' || entryModeRaw === 'WALK_IN'
          ? (entryModeRaw as VisitorEntryMode)
          : undefined,
      purpose: parsedPurpose?.success ? parsedPurpose.data : undefined,
      expectedAt: paramString(params.expectedAt),
    }),
    [
      params.name,
      params.phone,
      params.phoneCountryCode,
      params.vehiclePlate,
      entryModeRaw,
      purposeRaw,
      params.expectedAt,
    ],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{
        paddingVertical: 16,
        paddingBottom: 40,
        alignItems: 'center',
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 14, color: palette.mutedLight, lineHeight: 20 }}>
          Create a gate pass for an expected guest. Drive-in is the default — add a plate number or
          switch to walk-in.
        </Text>
      </View>
      <PreRegForm
        prefill={prefill}
        onSuccess={(visitorId) =>
          router.replace(`/(resident)/visitors/${visitorId}` as import('expo-router').Href)
        }
      />
    </ScrollView>
  );
}
