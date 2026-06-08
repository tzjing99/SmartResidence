import {
  formatUnitLabel,
  normalizeUnitSearchTerm,
  type UnitSearchItem,
} from '@smartresidence/shared-types';
import { palette, radius } from '@smartresidence/ui-mobile';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';

export type { UnitSearchItem };
export { formatUnitLabel };

type UnitSearchPickerProps = {
  condoId: string | null | undefined;
  value: UnitSearchItem | null;
  onChange: (unit: UnitSearchItem | null) => void;
  label?: string;
  placeholder?: string;
};

export function UnitSearchPicker({
  condoId,
  value,
  onChange,
  label = 'Unit',
  placeholder = 'Search block, unit, or resident…',
}: UnitSearchPickerProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value) setQuery(formatUnitLabel(value));
  }, [value]);

  const search = useQuery({
    queryKey: ['units', 'search', condoId, query],
    queryFn: () =>
      condoId
        ? api.listUnits(condoId, {
            search: normalizeUnitSearchTerm(query) || undefined,
            limit: 20,
          })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId) && focused && query.trim().length >= 1,
  });

  const items = (search.data?.items ?? []) as UnitSearchItem[];
  const showResults = focused && query.trim().length >= 1 && Boolean(condoId);

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          onChange(null);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        style={inputStyle}
      />
      {showResults ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.borderLight,
            borderRadius: radius.lg,
            overflow: 'hidden',
            maxHeight: 200,
          }}
        >
          {search.isLoading ? (
            <View style={{ padding: 12, alignItems: 'center' }}>
              <ActivityIndicator color={palette.coralPrimary} />
            </View>
          ) : items.length === 0 ? (
            <Text style={{ padding: 12, color: palette.mutedLight, fontSize: 13 }}>
              No units found
            </Text>
          ) : (
            items.map((unit) => (
              <Pressable
                key={unit.id}
                onPress={() => {
                  onChange(unit);
                  setQuery(formatUnitLabel(unit));
                  setFocused(false);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.04)' : 'transparent',
                })}
              >
                <Text style={{ fontSize: 14 }}>{formatUnitLabel(unit)}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const inputStyle = {
  height: 44,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.borderLight,
  paddingHorizontal: 12,
  fontSize: 14,
};
