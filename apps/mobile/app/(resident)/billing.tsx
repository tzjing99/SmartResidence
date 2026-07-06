import {
  useCreateAdvancePayment,
  useMyUnits,
  usePayInvoice,
  usePayableMethods,
  usePollDuitNowAdvanceStatus,
  usePollDuitNowInvoiceStatus,
  useUnitInvoices,
  useUnitReceipts,
  useUnitStatement,
} from '@smartresidence/api-client';
import type { ReceiptListItem } from '@smartresidence/api-client';
import {
  GATEWAY_PROVIDER_SHORT_LABELS,
  formatMoney,
  invoiceOutstanding,
} from '@smartresidence/shared-types';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  FadeInView,
  Input,
  Pill,
  SkeletonList,
  radius,
  spacing,
  useTheme,
} from '@smartresidence/ui-mobile';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  HostedPaymentBrowser,
  type HostedPaymentSession,
} from '../../src/components/hosted-payment-browser';
import {
  ResidentScreen,
  ResidentSectionHeader,
  prettyLabel,
  useResidentStyles,
} from '../../src/components/resident-screen';
import { usePullToRefresh } from '../../src/components/smart-refresh-control';
import { api } from '../../src/lib/api';
import { hapticError, hapticSelection, hapticSuccess } from '../../src/lib/haptics';
import {
  buildHostedGatewayReturnUrl,
  isPaymentReturnUrl,
  paymentDeepLink,
} from '../../src/lib/payment-return-url';

const ADVANCE_PRESETS = [100, 200, 400, 1000];

async function openDownloadedFile(uri: string, filename: string) {
  const canOpen = await Linking.canOpenURL(uri);
  if (canOpen) {
    await Linking.openURL(uri);
    return;
  }
  Alert.alert('Download ready', `${filename} saved to your device cache.`);
}

async function downloadStatementCsv(unitId: string, label: string) {
  try {
    const { uri, headers } = await api.unitStatementCsvDownloadSource(unitId);
    const path = `${FileSystem.cacheDirectory}statement-${label.replace(/[^\w.-]+/g, '-')}.csv`;
    const downloaded = await FileSystem.downloadAsync(uri, path, { headers });
    await openDownloadedFile(downloaded.uri, `statement-${label}.csv`);
  } catch (err) {
    Alert.alert('Download failed', (err as Error).message);
  }
}

async function downloadReceiptPdf(receiptId: string, number: string) {
  try {
    const { uri, headers } = await api.receiptPdfDownloadSource(receiptId);
    const path = `${FileSystem.cacheDirectory}${number}.pdf`;
    const downloaded = await FileSystem.downloadAsync(uri, path, { headers });
    await openDownloadedFile(downloaded.uri, `${number}.pdf`);
  } catch (err) {
    Alert.alert('Download failed', (err as Error).message);
  }
}

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
  const { colors } = useTheme();
  const styles = useResidentStyles();
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
    <Card style={[styles.card, { alignItems: 'center', gap: spacing.md }]}>
      <AppText style={{ fontWeight: '700', color: colors.fg }}>Scan DuitNow QR</AppText>
      {session.amountLabel ? (
        <AppText variant="meta" style={{ color: colors.muted }}>
          {session.amountLabel}
        </AppText>
      ) : null}
      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <QRCode value={session.qrPayload} size={220} />
      </View>
      <AppText variant="bodySm" style={{ color: colors.muted, textAlign: 'center' }}>
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
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; condoId?: string; identifier?: string } | undefined;
  const invoices = useUnitInvoices(api, unit?.id ?? null);
  const receipts = useUnitReceipts(api, unit?.id ?? null);
  const statement = useUnitStatement(api, unit?.id ?? null);
  const pay = usePayInvoice(api);
  const items = (invoices.data?.items as any[]) ?? [];
  const receiptItems = (receipts.data?.items ?? []) as ReceiptListItem[];
  const [downloadingStatement, setDownloadingStatement] = useState(false);
  const openItems = items.filter((inv) => inv.status !== 'PAID' && inv.status !== 'VOID');
  const condoId = unit?.condoId ?? openItems[0]?.condoId ?? items[0]?.condoId ?? null;
  const methods = usePayableMethods(api, condoId);
  const payableMethods = methods.data ?? [];
  const totalOutstanding = openItems.reduce((sum, inv) => sum + invoiceOutstanding(inv), 0);
  const [qrSession, setQrSession] = useState<QrSession | null>(null);
  const [hostedSession, setHostedSession] = useState<HostedPaymentSession | null>(null);
  const { refreshControl } = usePullToRefresh(
    useCallback(
      () =>
        Promise.all([invoices.refetch(), receipts.refetch(), statement.refetch()]).then(
          () => undefined,
        ),
      [invoices, receipts, statement],
    ),
  );

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
      hapticSuccess();
      Alert.alert('Payment ready', 'Confirm payment in the next screen.');
    } catch (err) {
      hapticError();
      Alert.alert('Payment failed', (err as Error).message);
    }
  }

  if (units.isLoading || invoices.isLoading) {
    return (
      <ResidentScreen
        eyebrow="Fees"
        title="Maintenance fees"
        subtitle="Review statements, formulas, and payment options without hidden surprises."
      >
        <SkeletonList rows={3} rowHeight={120} />
      </ResidentScreen>
    );
  }

  return (
    <ResidentScreen
      eyebrow="Fees"
      title="Maintenance fees"
      subtitle="Review statements, formulas, and payment options without hidden surprises."
      scrollProps={{ refreshControl }}
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

      <Card style={[styles.card, { gap: 4 }]}>
        <AppText variant="meta" style={{ color: colors.muted, fontWeight: '600' }}>
          Outstanding balance
        </AppText>
        <AppText
          style={{
            color: colors.fg,
            fontSize: 28,
            lineHeight: 34,
            fontWeight: '800',
            letterSpacing: -0.3,
          }}
        >
          {openItems.length === 0 ? 'All clear' : formatMoney(totalOutstanding)}
        </AppText>
        <AppText variant="meta" style={{ color: colors.muted }}>
          {openItems.length === 0
            ? 'No active invoices need payment right now.'
            : `${openItems.length} active invoice(s). Pay the invoice that is due soonest first.`}
        </AppText>
        {statement.data ? (
          <AppText variant="meta" style={{ color: colors.muted, marginTop: 4 }}>
            Account credit: {formatMoney(statement.data.creditBalance)}
          </AppText>
        ) : null}
        {unit?.id ? (
          <Button
            title={downloadingStatement ? 'Downloading…' : 'Download statement (CSV)'}
            variant="secondary"
            size="sm"
            disabled={downloadingStatement}
            onPress={async () => {
              setDownloadingStatement(true);
              try {
                await downloadStatementCsv(unit.id, unit.identifier ?? unit.id);
              } finally {
                setDownloadingStatement(false);
              }
            }}
            style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
          />
        ) : null}
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
        items.map((inv, index) => (
          <FadeInView key={inv.id} index={index}>
            <Card style={[styles.card, { gap: spacing.sm }]}>
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
                        <AppText style={{ fontWeight: '700', color: colors.fg }} numberOfLines={2}>
                          {inv.number}
                        </AppText>
                        <AppText variant="meta" style={{ color: colors.muted, marginTop: 2 }}>
                          Due {new Date(inv.dueDate).toLocaleDateString()}
                        </AppText>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <AppText style={{ fontSize: 20, lineHeight: 26, fontWeight: '800' }}>
                          {formatMoney(outstanding, inv.currencyCode ?? 'MYR')}
                        </AppText>
                        {Number(inv.amountPaid) > 0 && outstanding > 0.005 ? (
                          <AppText variant="caption" style={{ color: colors.muted }}>
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
                        borderTopColor: colors.border,
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
                              <AppText variant="caption" style={{ color: colors.muted }}>
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
                            .find(
                              (p: { status: string; provider?: string }) => p.status === 'PENDING',
                            );
                          return pending ? (
                            <AppText variant="caption" style={{ color: colors.muted }}>
                              {GATEWAY_PROVIDER_SHORT_LABELS[pending.provider] ?? pending.provider}{' '}
                              payment is awaiting confirmation. Choose another method below to
                              switch — the previous attempt will be cancelled.
                            </AppText>
                          ) : null;
                        })()}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {(methods.data ?? []).length === 0 ? (
                            <AppText variant="caption" style={{ color: colors.muted }}>
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
          </FadeInView>
        ))
      )}

      {unit?.id && condoId && payableMethods.length > 0 ? (
        <AdvanceMaintenancePayment unitId={unit.id} condoId={condoId} />
      ) : null}

      <ResidentSectionHeader
        title="Receipts"
        subtitle="Download official PDF receipts for payments on your unit."
      />
      {receipts.isLoading ? (
        <SkeletonList rows={2} rowHeight={72} />
      ) : receiptItems.length === 0 ? (
        <EmptyState title="No receipts yet" description="Receipts appear here once issued." />
      ) : (
        receiptItems.map((r, index) => (
          <FadeInView key={r.id} index={index}>
            <Card style={[styles.card, { gap: spacing.sm }]}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, minWidth: 160 }}>
                  <AppText style={{ fontWeight: '700', color: colors.fg }}>
                    {r.number}
                  </AppText>
                  <AppText variant="meta" style={{ color: colors.muted, marginTop: 2 }}>
                    {new Date(r.issuedAt).toLocaleDateString()} ·{' '}
                    {formatMoney(r.amount, r.currencyCode ?? 'MYR')}
                  </AppText>
                </View>
                <Button
                  title="Download PDF"
                  variant="secondary"
                  size="sm"
                  onPress={() => downloadReceiptPdf(r.id, r.number)}
                />
              </View>
            </Card>
          </FadeInView>
        ))
      )}
    </ResidentScreen>
  );
}

function AdvanceMaintenancePayment({ unitId, condoId }: { unitId: string; condoId: string }) {
  const { colors } = useTheme();
  const styles = useResidentStyles();
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
          setHostedSession({
            title: `Pay ${amountLabel} in advance`,
            redirectUrl: res.redirectUrl,
          });
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
      <Card style={[styles.card, { gap: spacing.md }]}>
        <AppText variant="bodySm" style={{ color: colors.muted }}>
          Choose an amount to pay ahead. After the gateway confirms payment, the amount becomes
          prepaid credit and offsets your next fee invoice.
        </AppText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ADVANCE_PRESETS.map((value) => (
            <Chip
              key={value}
              label={formatMoney(value)}
              active={selected === value}
              onPress={() => {
                hapticSelection();
                setSelected(value);
              }}
            />
          ))}
          <Chip
            label="Other"
            active={selected === 'OTHER'}
            onPress={() => {
              hapticSelection();
              setSelected('OTHER');
            }}
          />
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
