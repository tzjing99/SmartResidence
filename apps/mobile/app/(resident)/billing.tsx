import {
  invalidateUnitAccessRestrictionStatus,
  useCreateAdvancePayment,
  useMyUnits,
  usePayInvoice,
  usePayableMethods,
  usePollDuitNowAdvanceStatus,
  usePollDuitNowInvoiceStatus,
  useUnitAccessRestrictionStatus,
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
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useT } from '../../src/i18n/locale-provider';
import { api } from '../../src/lib/api';
import { hapticError, hapticSelection, hapticSuccess } from '../../src/lib/haptics';
import {
  buildHostedGatewayReturnUrl,
  isPaymentReturnUrl,
  paymentDeepLink,
} from '../../src/lib/payment-return-url';

const ADVANCE_PRESETS = [100, 200, 400, 1000];

type Translate = (key: string, vars?: Record<string, string | number>) => string;

async function openDownloadedFile(uri: string, filename: string, t: Translate) {
  const canOpen = await Linking.canOpenURL(uri);
  if (canOpen) {
    await Linking.openURL(uri);
    return;
  }
  Alert.alert(
    t('mobile.billing.downloadReady'),
    t('mobile.billing.downloadReadyBody', { filename }),
  );
}

async function downloadStatementCsv(unitId: string, label: string, t: Translate) {
  try {
    const { uri, headers } = await api.unitStatementCsvDownloadSource(unitId);
    const path = `${FileSystem.cacheDirectory}statement-${label.replace(/[^\w.-]+/g, '-')}.csv`;
    const downloaded = await FileSystem.downloadAsync(uri, path, { headers });
    await openDownloadedFile(downloaded.uri, `statement-${label}.csv`, t);
  } catch (err) {
    Alert.alert(t('mobile.billing.downloadFailed'), (err as Error).message);
  }
}

async function downloadReceiptPdf(receiptId: string, number: string, t: Translate) {
  try {
    const { uri, headers } = await api.receiptPdfDownloadSource(receiptId);
    const path = `${FileSystem.cacheDirectory}${number}.pdf`;
    const downloaded = await FileSystem.downloadAsync(uri, path, { headers });
    await openDownloadedFile(downloaded.uri, `${number}.pdf`, t);
  } catch (err) {
    Alert.alert(t('mobile.billing.downloadFailed'), (err as Error).message);
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
  showAccessRestored,
}: {
  session: QrSession;
  onClose: () => void;
  showAccessRestored?: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
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
  const settledNotified = useRef(false);

  useEffect(() => {
    if (!poll.data?.settled || settledNotified.current) return;
    settledNotified.current = true;
    invalidateUnitAccessRestrictionStatus(qc);
    void qc.invalidateQueries({ queryKey: ['invoices'] });
    if (showAccessRestored) {
      Alert.alert(t('billing.accessRestoredTitle'), t('billing.accessRestoredBody'));
    }
  }, [poll.data?.settled, qc, showAccessRestored, t]);

  return (
    <Card style={[styles.card, { alignItems: 'center', gap: spacing.md }]}>
      <AppText style={{ fontWeight: '700', color: colors.fg }}>
        {t('mobile.billing.scanQr')}
      </AppText>
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
        <View style={{ alignItems: 'center', gap: 4 }}>
          <AppText style={{ color: '#059669', fontWeight: '600' }}>Payment confirmed!</AppText>
          {showAccessRestored ? (
            <AppText variant="bodySm" style={{ color: '#059669', textAlign: 'center' }}>
              {t('billing.accessRestoredBody')}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <Button title={t('actions.close')} variant="secondary" size="sm" onPress={onClose} />
    </Card>
  );
}

export default function BillingScreen() {
  const t = useT();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const styles = useResidentStyles();
  const units = useMyUnits(api);
  const unit = units.data?.[0] as { id: string; condoId?: string; identifier?: string } | undefined;
  const invoices = useUnitInvoices(api, unit?.id ?? null);
  const receipts = useUnitReceipts(api, unit?.id ?? null);
  const statement = useUnitStatement(api, unit?.id ?? null);
  const accessStatus = useUnitAccessRestrictionStatus(api, unit?.id ?? null);
  const wasRestrictedRef = useRef(false);
  const pay = usePayInvoice(api);

  useEffect(() => {
    if (accessStatus.data?.restricted) wasRestrictedRef.current = true;
  }, [accessStatus.data?.restricted]);
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
      Alert.alert(t('mobile.billing.paymentReady'), t('mobile.billing.paymentReadyBody'));
    } catch (err) {
      hapticError();
      Alert.alert(t('mobile.billing.paymentFailed'), (err as Error).message);
    }
  }

  if (units.isLoading || invoices.isLoading) {
    return (
      <ResidentScreen
        eyebrow={t('mobile.billing.eyebrow')}
        title={t('mobile.billing.title')}
        subtitle={t('mobile.billing.subtitle')}
      >
        <SkeletonList rows={3} rowHeight={120} />
      </ResidentScreen>
    );
  }

  return (
    <ResidentScreen
      eyebrow={t('mobile.billing.eyebrow')}
      title={t('mobile.billing.title')}
      subtitle={t('mobile.billing.subtitle')}
      scrollProps={{ refreshControl }}
    >
      {qrSession ? (
        <DuitNowQrCard
          session={qrSession}
          onClose={() => setQrSession(null)}
          showAccessRestored={wasRestrictedRef.current}
        />
      ) : null}
      <HostedPaymentBrowser
        session={hostedSession}
        onClose={() => setHostedSession(null)}
        onComplete={() => {
          void invoices.refetch();
          invalidateUnitAccessRestrictionStatus(qc);
          if (wasRestrictedRef.current) {
            Alert.alert(t('billing.accessRestoredTitle'), t('billing.accessRestoredBody'));
            wasRestrictedRef.current = false;
          } else {
            Alert.alert(
              t('mobile.billing.paymentSubmitted'),
              t('mobile.billing.paymentSubmittedBody'),
            );
          }
        }}
      />

      <Card style={[styles.card, { gap: 4 }]}>
        <AppText variant="meta" style={{ color: colors.muted, fontWeight: '600' }}>
          {t('mobile.billing.outstanding')}
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
          {openItems.length === 0 ? t('mobile.billing.allClear') : formatMoney(totalOutstanding)}
        </AppText>
        <AppText variant="meta" style={{ color: colors.muted }}>
          {openItems.length === 0
            ? t('mobile.billing.noActiveInvoices')
            : t('mobile.billing.activeInvoices', { count: openItems.length })}
        </AppText>
        {statement.data ? (
          <AppText variant="meta" style={{ color: colors.muted, marginTop: 4 }}>
            {t('mobile.billing.accountCredit', {
              amount: formatMoney(statement.data.creditBalance),
            })}
          </AppText>
        ) : null}
        {unit?.id ? (
          <Button
            title={
              downloadingStatement
                ? t('mobile.billing.downloading')
                : t('mobile.billing.downloadStatement')
            }
            variant="secondary"
            size="sm"
            disabled={downloadingStatement}
            onPress={async () => {
              setDownloadingStatement(true);
              try {
                await downloadStatementCsv(unit.id, unit.identifier ?? unit.id, t);
              } finally {
                setDownloadingStatement(false);
              }
            }}
            style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
          />
        ) : null}
      </Card>

      <ResidentSectionHeader
        title={t('mobile.billing.statements')}
        subtitle={t('mobile.billing.statementsDesc')}
      />

      {items.length === 0 ? (
        <EmptyState
          title={t('mobile.billing.noInvoices')}
          description={t('mobile.billing.noInvoicesDesc')}
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
        title={t('billing.receiptsTitle')}
        subtitle={t('billing.receiptsDesc')}
      />
      {receipts.isLoading ? (
        <SkeletonList rows={2} rowHeight={72} />
      ) : receiptItems.length === 0 ? (
        <EmptyState
          title={t('billing.noReceiptsTitle')}
          description={t('billing.noReceiptsDesc')}
        />
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
                  <AppText style={{ fontWeight: '700', color: colors.fg }}>{r.number}</AppText>
                  <AppText variant="meta" style={{ color: colors.muted, marginTop: 2 }}>
                    {new Date(r.issuedAt).toLocaleDateString()} ·{' '}
                    {formatMoney(r.amount, r.currencyCode ?? 'MYR')}
                  </AppText>
                </View>
                <Button
                  title={t('actions.downloadPdf')}
                  variant="secondary"
                  size="sm"
                  onPress={() => downloadReceiptPdf(r.id, r.number, t)}
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
  const t = useT();
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
      Alert.alert(t('mobile.billing.enterAmountTitle'), t('mobile.billing.enterAmountBody'));
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
        setHostedSession({
          title: `Pay ${amountLabel} in advance`,
          formPost: res.formPost,
        });
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
      Alert.alert(t('billing.advanceEyebrow'), t('billing.advanceStartedToast'));
    } catch (err) {
      Alert.alert(t('mobile.billing.advanceFailed'), (err as Error).message);
    }
  }

  return (
    <>
      {qrSession ? <DuitNowQrCard session={qrSession} onClose={() => setQrSession(null)} /> : null}
      <HostedPaymentBrowser
        session={hostedSession}
        onClose={() => setHostedSession(null)}
        onComplete={() => {
          Alert.alert(
            t('mobile.billing.paymentSubmitted'),
            t('mobile.billing.advanceSubmittedBody'),
          );
        }}
      />
      <ResidentSectionHeader
        title={t('mobile.billing.payAdvance')}
        subtitle={t('billing.advanceDesc')}
      />
      <Card style={[styles.card, { gap: spacing.md }]}>
        <AppText variant="bodySm" style={{ color: colors.muted }}>
          {t('billing.advanceConfirmNote')}
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
            label={t('billing.otherAmount')}
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
            placeholder={t('billing.otherAmountLabel')}
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
