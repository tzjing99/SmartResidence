import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { Button, Card, EmptyState, Pill, palette } from '@smartresidence/ui-mobile';
import { formatMoney } from '@smartresidence/shared-types';
import { useMyUnits, useUnitInvoices, usePayInvoice } from '@smartresidence/api-client';
import { api } from '../../src/lib/api';

export default function BillingScreen() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string } | undefined;
  const invoices = useUnitInvoices(api, unit?.id ?? null);
  const pay = usePayInvoice(api);

  async function handlePay(id: string, provider: string) {
    try {
      const res = await pay.mutateAsync({
        id,
        provider,
        returnUrl: 'smartresidence://billing',
      });
      if (res.redirectUrl) await Linking.openURL(res.redirectUrl);
      else Alert.alert('Payment ready', 'Confirm payment in the next screen.');
    } catch (err) {
      Alert.alert('Payment failed', (err as Error).message);
    }
  }

  const items = (invoices.data?.items as any[]) ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgLight }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Maintenance fees</Text>
      <Text style={{ color: palette.mutedLight, marginTop: -10 }}>
        Every line shows the formula. No hidden fees.
      </Text>

      {items.length === 0 ? (
        <EmptyState title="No invoices" description="Your fee statements appear here once issued." />
      ) : (
        items.map((inv) => (
          <Card key={inv.id}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View>
                <Text style={{ fontWeight: '700' }}>{inv.number}</Text>
                <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 2 }}>
                  Due {new Date(inv.dueDate).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 18, fontWeight: '700' }}>
                  {formatMoney(inv.total, inv.currencyCode ?? 'MYR')}
                </Text>
                <Pill
                  tone={
                    inv.status === 'PAID'
                      ? 'success'
                      : inv.status === 'OVERDUE'
                        ? 'danger'
                        : 'primary'
                  }
                  label={inv.status.toLowerCase()}
                />
              </View>
            </View>

            <View
              style={{
                marginTop: 12,
                borderTopWidth: 1,
                borderTopColor: palette.borderLight,
                paddingTop: 10,
              }}
            >
              {(inv.lines ?? []).map((l: any) => (
                <View
                  key={l.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 4,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 13 }}>{l.description}</Text>
                    {l.formula ? (
                      <Text style={{ color: palette.mutedLight, fontSize: 11 }}>{l.formula}</Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600' }}>
                    {formatMoney(l.amount, inv.currencyCode ?? 'MYR')}
                  </Text>
                </View>
              ))}
            </View>

            {inv.status !== 'PAID' && inv.status !== 'VOID' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button
                  title="Pay with card"
                  onPress={() => handlePay(inv.id, 'STRIPE')}
                  size="sm"
                />
                <Button
                  title="FPX"
                  variant="secondary"
                  onPress={() => handlePay(inv.id, 'FPX')}
                  size="sm"
                />
              </View>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
