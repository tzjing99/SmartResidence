import { useMyUnits, usePayInvoice, useUnitInvoices } from '@smartresidence/api-client';
import { formatMoney } from '@smartresidence/shared-types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Pill,
  palette,
  spacing,
} from '@smartresidence/ui-mobile';
import { Alert, Linking, View } from 'react-native';
import {
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  residentStyles,
} from '../../src/components/resident-screen';
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
  const openItems = items.filter((inv) => inv.status !== 'PAID' && inv.status !== 'VOID');

  return (
    <ResidentScreen
      eyebrow="Fees"
      title="Maintenance fees"
      subtitle="Review statements, formulas, and payment options without hidden surprises."
    >
      <Card style={[residentStyles.card, { gap: 4 }]}>
        <AppText variant="meta" style={{ color: palette.mutedLight, fontWeight: '600' }}>
          Outstanding balance
        </AppText>
        <AppText
          style={{
            color: palette.textLight,
            fontSize: 28,
            lineHeight: 34,
            fontWeight: '800',
            letterSpacing: -0.3,
          }}
        >
          {openItems.length === 0 ? 'All clear' : `${openItems.length} to review`}
        </AppText>
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          {openItems.length === 0
            ? 'No active invoices need payment right now.'
            : 'Pay the invoice that is due soonest first.'}
        </AppText>
      </Card>

      <ResidentSectionHeader
        title="Statements"
        subtitle="Each charge keeps its formula visible for easier checking."
      />

      {items.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="Your fee statements appear here once issued."
        />
      ) : (
        items.map((inv) => (
          <Card key={inv.id} style={[residentStyles.card, { gap: spacing.sm }]}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 180 }}>
                <AppText style={{ fontWeight: '700', color: palette.textLight }} numberOfLines={2}>
                  {inv.number}
                </AppText>
                <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 2 }}>
                  Due {new Date(inv.dueDate).toLocaleDateString()}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <AppText style={{ fontSize: 20, lineHeight: 26, fontWeight: '800' }}>
                  {formatMoney(inv.total, inv.currencyCode ?? 'MYR')}
                </AppText>
                <Pill
                  tone={
                    inv.status === 'PAID'
                      ? 'success'
                      : inv.status === 'OVERDUE'
                        ? 'danger'
                        : 'primary'
                  }
                  label={prettyLabel(inv.status)}
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
                    alignItems: 'flex-start',
                    gap: 12,
                    paddingVertical: 4,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="bodySm" numberOfLines={2}>
                      {l.description}
                    </AppText>
                    {l.formula ? (
                      <AppText variant="caption" style={{ color: palette.mutedLight }}>
                        {l.formula}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText variant="bodySm" style={{ fontWeight: '700' }}>
                    {formatMoney(l.amount, inv.currencyCode ?? 'MYR')}
                  </AppText>
                </View>
              ))}
            </View>

            {inv.status !== 'PAID' && inv.status !== 'VOID' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                <Button
                  title="Pay with card"
                  onPress={() => handlePay(inv.id, 'STRIPE')}
                  size="sm"
                  style={{ flexGrow: 1 }}
                />
                <Button
                  title="FPX"
                  variant="secondary"
                  onPress={() => handlePay(inv.id, 'FPX')}
                  size="sm"
                  style={{ flexGrow: 1 }}
                />
              </View>
            ) : null}
          </Card>
        ))
      )}
    </ResidentScreen>
  );
}
