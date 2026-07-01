import {
  useCreateAdvancePayment,
  useMyUnits,
  usePayInvoice,
  usePayableMethods,
  usePollDuitNowAdvanceStatus,
  usePollDuitNowInvoiceStatus,
  useUnitInvoices,
} from '@smartresidence/api-client';
import {
  GATEWAY_PROVIDER_SHORT_LABELS,
  formatMoney,
  invoiceOutstanding,
} from '@smartresidence/shared-types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Input,
  Pill,
  palette,
  radius,
  spacing,
} from '@smartresidence/ui-mobile';
import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  HostedPaymentBrowser,
  type HostedPaymentSession,
} from '../../src/components/hosted-payment-browser';
import {
  RESIDENT_CORAL,
  RESIDENT_SOFT_CORAL,
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  residentStyles,
} from '../../src/components/resident-screen';
import { api } from '../../src/lib/api';
import { buildHostedGatewayReturnUrl, isPaymentReturnUrl, paymentDeepLink } from '../../src/lib/payment-return-url';

const ADVANCE_PRESETS = [100, 200, 400, 1000];

type QrSession = {
  qrPayload: string;
  paymentId?: string;
  advancePaymentId?: string;
  amountLabel?: string;
};

function DuitNowQrCard({
  session,
  onClose,
}: {
  session: QrSession;
  onClose: () => void;
}) {
  const invoicePoll = usePollDuitNowInvoiceStatus(
    api,
    session.paymentId ?? null,
    Boolean(session.paymentId),
  );
  const advancePoll = usePollDuitNowAdvanceStatus(
    api,
    session.advancePaymentId ?? null,
    Boolean(session.advancePaymentId),
  );
  const poll = session.paymentId ? invoicePoll : advancePoll;

  return (
    <Card style={[residentStyles.card, { alignItems: 'center', gap: spacing.md }]}>
      <AppText style={{ fontWeight: '700', color: palette.textLight }}>Scan DuitNow QR</AppText>
      {session.amountLabel ? (
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          {session.amountLabel}
        </AppText>
      ) : null}
      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: palette.borderLight,
        }}
      >
        <QRCode value={session.qrPayload} size={220} />
      </View>
      <AppText variant="bodySm" style={{ color: palette.mutedLight, textAlign: 'center' }}>
        Open your banking app, choose DuitNow QR, and scan. Keep this screen open until payment is
        confirmed.
      </AppText>
      {poll.data?.settled ? (
        <AppText style={{ color: '#059669', fontWeight: '600' }}>Payment confirmed!</AppText>
      ) : null}
      <Button title="Close" variant="secondary" size="sm" onPress={onClose} />
    </Card>
  );
}

export default function BillingScreen() {
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; condoId?: string } | undefined;
  const invoices = useUnitInvoices(api, unit?.id ?? null);
  const pay = usePayInvoice(api);
  const items = (invoices.data?.items as any[]) ?? [];
  const openItems = items.filter((inv) => inv.status !== 'PAID' && inv.status !== 'VOID');
  const condoId = unit?.condoId ?? openItems[0]?.condoId ?? items[0]?.condoId ?? null;
  const methods = usePayableMethods(api, condoId);
  const payableMethods = methods.data ?? [];
  const totalOutstanding = openItems.reduce((sum, inv) => sum + invoiceOutstanding(inv), 0);
  const [qrSession, setQrSession] = useState<QrSession | null>(null);
  const [hostedSession, setHostedSession] = useState<HostedPaymentSession | null>(null);

  async function handlePay(id: string, provider: string, amountLabel: string) {
    try {
      const res = await pay.mutateAsync({
        id,
        provider,
        returnUrl: buildHostedGatewayReturnUrl(provider),
      });
      if (res.qrPayload) {
        setQrSession({
          qrPayload: res.qrPayload,
          paymentId: res.paymentId,
          amountLabel,
        });
        return;
      }
      if (res.formPost) {
        setHostedSession({
          title: `Pay ${amountLabel}`,
          formPost: res.formPost,
        });
        return;
      }
      if (res.redirectUrl) {
        if (isPaymentReturnUrl(res.redirectUrl)) {
          await Linking.openURL(res.redirectUrl);
        } else {
          setHostedSession({ title: `Pay ${amountLabel}`, redirectUrl: res.redirectUrl });
        }
        return;
      }
      Alert.alert('Payment ready', 'Confirm payment in the next screen.');
    } catch (err) {
      Alert.alert('Payment failed', (err as Error).message);
    }
  }

  return (
    <ResidentScreen
      eyebrow="Fees"
      title="Maintenance fees"
      subtitle="Review statements, formulas, and payment options without hidden surprises."
    >
      {qrSession ? <DuitNowQrCard session={qrSession} onClose={() => setQrSession(null)} /> : null}
      <HostedPaymentBrowser
        session={hostedSession}
        onClose={() => setHostedSession(null)}
        onComplete={() => {
          void invoices.refetch();
          Alert.alert('Payment submitted', 'We are confirming your payment with the bank.');
        }}
      />

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
          {openItems.length === 0 ? 'All clear' : formatMoney(totalOutstanding)}
        </AppText>
        <AppText variant="meta" style={{ color: palette.mutedLight }}>
          {openItems.length === 0
            ? 'No active invoices need payment right now.'
            : `${openItems.length} active invoice(s). Pay the invoice that is due soonest first.`}
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
            {(() => {
              const outstanding = invoiceOutstanding(inv);
              return (
                <>
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
                      <AppText
                        style={{ fontWeight: '700', color: palette.textLight }}
                        numberOfLines={2}
                      >
                        {inv.number}
                      </AppText>
                      <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 2 }}>
                        Due {new Date(inv.dueDate).toLocaleDateString()}
                      </AppText>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <AppText style={{ fontSize: 20, lineHeight: 26, fontWeight: '800' }}>
                        {formatMoney(outstanding, inv.currencyCode ?? 'MYR')}
                      </AppText>
                      {Number(inv.amountPaid) > 0 && outstanding > 0.005 ? (
                        <AppText variant="caption" style={{ color: palette.mutedLight }}>
                          of {formatMoney(inv.total, inv.currencyCode ?? 'MYR')}
                        </AppText>
                      ) : null}
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
                    <View style={{ gap: 8, marginTop: 4 }}>
                      {(() => {
                        const pending = (inv.payments ?? [])
                          .filter((p: { status: string }) => p.status !== 'CANCELLED')
                          .find((p: { status: string; provider?: string }) => p.status === 'PENDING');
                        return pending ? (
                          <AppText variant="caption" style={{ color: palette.mutedLight }}>
                            {GATEWAY_PROVIDER_SHORT_LABELS[pending.provider] ?? pending.provider}{' '}
                            payment is awaiting confirmation. Choose another method below to switch
                            — the previous attempt will be cancelled.
                          </AppText>
                        ) : null;
                      })()}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {(methods.data ?? []).length === 0 ? (
                          <AppText variant="caption" style={{ color: palette.mutedLight }}>
                            Online payment is not enabled for this condo yet.
                          </AppText>
                        ) : (
                          (methods.data ?? []).map((method) => (
                            <Button
                              key={`${inv.id}-${method.provider}-${method.mode}`}
                              title={`${method.label}${method.mode === 'TEST' ? ' (TEST)' : ''}`}
                              variant={method.mode === 'TEST' ? 'secondary' : 'primary'}
                              onPress={() =>
                                handlePay(
                                  inv.id,
                                  method.provider,
                                  formatMoney(invoiceOutstanding(inv), inv.currencyCode),
                                )
                              }
                              disabled={pay.isPending}
                              size="sm"
                              style={{ flexGrow: 1 }}
                            />
                          ))
                        )}
                      </View>
                    </View>
                  ) : null}
                </>
              );
            })()}
          </Card>
        ))
      )}

      {unit?.id && condoId && payableMethods.length > 0 ? (
        <AdvanceMaintenancePayment unitId={unit.id} condoId={condoId} />
      ) : null}
    </ResidentScreen>
  );
}

function AdvanceMaintenancePayment({ unitId, condoId }: { unitId: string; condoId: string }) {
  const methods = usePayableMethods(api, condoId);
  const createAdvance = useCreateAdvancePayment(api);
  const [selected, setSelected] = useState<number | 'OTHER'>(100);
  const [customAmount, setCustomAmount] = useState('');
  const [qrSession, setQrSession] = useState<QrSession | null>(null);
  const [hostedSession, setHostedSession] = useState<HostedPaymentSession | null>(null);
  const payableMethods = methods.data ?? [];
  const amount = selected === 'OTHER' ? Number(customAmount) : selected;

  async function startAdvancePayment(provider: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Enter an amount', 'Choose or enter a valid advance payment amount.');
      return;
    }
    const amountLabel = formatMoney(amount);
    try {
      const res = await createAdvance.mutateAsync({
        unitId,
        amount,
        provider: provider as never,
        returnUrl: buildHostedGatewayReturnUrl(provider, paymentDeepLink({ advance: '1' })),
      });
      if (res.qrPayload) {
        setQrSession({
          qrPayload: res.qrPayload,
          advancePaymentId: res.advancePaymentId,
          amountLabel,
        });
        return;
      }
      if (res.formPost) {
        setHostedSession({ title: `Pay ${amountLabel} in advance`, formPost: res.formPost });
        return;
      }
      if (res.redirectUrl) {
        if (isPaymentReturnUrl(res.redirectUrl)) {
          await Linking.openURL(res.redirectUrl);
        } else {
          setHostedSession({ title: `Pay ${amountLabel} in advance`, redirectUrl: res.redirectUrl });
        }
        return;
      }
      Alert.alert(
        'Advance payment started',
        'Complete the gateway prompt to add prepaid credit to your account.',
      );
    } catch (err) {
      Alert.alert('Could not start advance payment', (err as Error).message);
    }
  }

  return (
    <>
      {qrSession ? <DuitNowQrCard session={qrSession} onClose={() => setQrSession(null)} /> : null}
      <HostedPaymentBrowser
        session={hostedSession}
        onClose={() => setHostedSession(null)}
        onComplete={() => {
          Alert.alert('Payment submitted', 'We are confirming your advance payment with the bank.');
        }}
      />
      <ResidentSectionHeader
        title="Pay in advance"
        subtitle="Add prepaid credit that is automatically applied to your next maintenance invoice."
      />
      <Card style={[residentStyles.card, { gap: spacing.md }]}>
        <AppText variant="bodySm" style={{ color: palette.mutedLight }}>
          Choose an amount to pay ahead. After the gateway confirms payment, the amount becomes
          prepaid credit and offsets your next fee invoice.
        </AppText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ADVANCE_PRESETS.map((value) => {
            const active = selected === value;
            return (
              <Pressable
                key={value}
                onPress={() => setSelected(value)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: radius.full,
                  backgroundColor: active ? RESIDENT_SOFT_CORAL : palette.surfaceLight,
                  borderWidth: 1,
                  borderColor: active ? 'rgba(255, 56, 92, 0.25)' : palette.borderLight,
                }}
              >
                <AppText
                  style={{
                    fontWeight: '700',
                    color: active ? RESIDENT_CORAL : palette.textLight,
                  }}
                >
                  {formatMoney(value)}
                </AppText>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setSelected('OTHER')}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: radius.full,
              backgroundColor: selected === 'OTHER' ? RESIDENT_SOFT_CORAL : palette.surfaceLight,
              borderWidth: 1,
              borderColor: selected === 'OTHER' ? 'rgba(255, 56, 92, 0.25)' : palette.borderLight,
            }}
          >
            <AppText
              style={{
                fontWeight: '700',
                color: selected === 'OTHER' ? RESIDENT_CORAL : palette.textLight,
              }}
            >
              Other
            </AppText>
          </Pressable>
        </View>

        {selected === 'OTHER' ? (
          <Input
            value={customAmount}
            onChangeText={setCustomAmount}
            placeholder="Enter amount (MYR)"
            keyboardType="decimal-pad"
          />
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {payableMethods.map((method) => (
            <Button
              key={`advance-${method.provider}-${method.mode}`}
              title={`Pay ${formatMoney(amount || 0)}${method.mode === 'TEST' ? ' (TEST)' : ` · ${method.label}`}`}
              variant={method.mode === 'TEST' ? 'secondary' : 'primary'}
              onPress={() => startAdvancePayment(method.provider)}
              disabled={createAdvance.isPending || !Number.isFinite(amount) || amount <= 0}
              size="sm"
              style={{ flexGrow: 1 }}
            />
          ))}
        </View>
      </Card>
    </>
  );
}
