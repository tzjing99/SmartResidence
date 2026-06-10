import { Ionicons } from '@expo/vector-icons';
import {
  useGuardApproveWalkIn,
  useGuardWalkInPolicy,
  useMyCondos,
} from '@smartresidence/api-client';
import {
  type GuardApprovalMethod,
  type Visitor,
  formatMalaysiaPhoneDisplay,
  isValidMalaysiaPhone,
  malaysiaPhoneTelHref,
  pickOwnerPhone,
} from '@smartresidence/shared-types';
import { AppText, Button, Card, Pill, palette, radius, spacing } from '@smartresidence/ui-mobile';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, TextInput, View } from 'react-native';
import {
  GUARD_CORAL,
  GUARD_SOFT_CORAL,
  GUARD_SOFT_SKY,
  GuardScreen,
  GuardSectionHeader,
  guardStyles,
} from '../../src/components/guard-screen';
import { type UnitSearchItem, UnitSearchPicker } from '../../src/components/unit-search-picker';
import { api } from '../../src/lib/api';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

type Tab = 'unit' | 'office';

function callPhone(phone: string, label: string, phoneCountryCode?: string | null) {
  const href = malaysiaPhoneTelHref(phone, phoneCountryCode);
  if (!href) return;
  Linking.openURL(href).catch(() => {
    Alert.alert(
      'Could not open dialer',
      `${label}: ${formatMalaysiaPhoneDisplay(phone, phoneCountryCode) ?? phone}`,
    );
  });
}

function callOwner(contacts: Visitor['ownerContacts']) {
  const contact = pickOwnerPhone(contacts);
  if (!contact?.phone) {
    Alert.alert('No phone on file', 'The unit owner has no phone number — contact management.');
    return;
  }
  callPhone(contact.phone, contact.name);
}

export default function WalkInScreen() {
  const { twoColumn } = useTabletLayout();
  const condos = useMyCondos(api);
  const condo = condos.data?.[0];
  const walkInPolicy = useGuardWalkInPolicy(api);
  const requireOwnerApproval = walkInPolicy.data?.walkInRequireOwnerApproval ?? true;
  const approvalMinutes = walkInPolicy.data?.walkInApprovalMinutes ?? 15;
  const [tab, setTab] = useState<Tab>('unit');
  const [unit, setUnit] = useState<UnitSearchItem | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingVisitor, setPendingVisitor] = useState<Visitor | null>(null);
  const approveWalkIn = useGuardApproveWalkIn(api);

  const pendingWalkIns = useQuery({
    queryKey: ['guard', 'pending-walk-ins', condo?.id],
    queryFn: () =>
      condo
        ? api.visitorsForCondo(condo.id, { status: 'PENDING_OWNER_APPROVAL', limit: 20 })
        : Promise.resolve({ items: [], total: 0 }),
    refetchInterval: 15_000,
    enabled: Boolean(condo && requireOwnerApproval),
  });

  function validatePhone(): boolean {
    if (!phone.trim()) {
      Alert.alert('Phone required', "Enter the visitor's phone number.");
      return false;
    }
    if (!isValidMalaysiaPhone(phone)) {
      Alert.alert('Invalid phone', 'Enter a valid Malaysia mobile number (e.g. +60123456789).');
      return false;
    }
    return true;
  }

  function handleGuardApprove(visitor: Visitor, method: GuardApprovalMethod) {
    const run = async () => {
      try {
        await approveWalkIn.mutateAsync({ visitorId: visitor.id, method });
        Alert.alert('Checked in', `${visitor.name} approved and checked in at the gate.`);
        if (pendingVisitor?.id === visitor.id) setPendingVisitor(null);
        pendingWalkIns.refetch();
      } catch (err) {
        Alert.alert('Could not approve', (err as Error).message);
      }
    };
    if (method === 'GUARD_MANUAL') {
      Alert.alert(
        'Approve this visitor?',
        `You're confirming ${visitor.name} is a legitimate visitor. They'll be checked in immediately and recorded against your name.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Approve & check in', onPress: run },
        ],
      );
    } else {
      void run();
    }
  }

  async function submitUnit() {
    if (!unit?.id || !name.trim()) {
      Alert.alert('Unit required', 'Search and select the unit the visitor is going to.');
      return;
    }
    if (!validatePhone()) return;
    setBusy(true);
    try {
      const visitor = await api.createWalkInUnit({
        unitId: unit.id,
        name: name.trim(),
        phone: phone.trim(),
        purpose: purpose || undefined,
      });
      if (visitor.status === 'CHECKED_IN') {
        Alert.alert('Checked in', `${name.trim()} checked in at the gate.`);
        setPendingVisitor(null);
      } else {
        Alert.alert(
          'Sent for approval',
          `Unit owner has ${approvalMinutes} minutes to respond. You can call them if needed.`,
        );
        setPendingVisitor(visitor);
      }
      setName('');
      setPhone('');
      setPurpose('');
      setUnit(null);
      pendingWalkIns.refetch();
    } catch (err) {
      Alert.alert('Could not register', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitOffice() {
    if (!name.trim() || !purpose.trim()) {
      Alert.alert('Purpose required', 'Enter why the visitor is seeing management.');
      return;
    }
    if (!validatePhone()) return;
    setBusy(true);
    try {
      await api.createWalkInOffice({
        name: name.trim(),
        phone: phone.trim(),
        purpose: purpose.trim(),
        gateLocation: 'Management office',
      });
      Alert.alert('Logged in', `${name.trim()} checked in at management office.`);
      setName('');
      setPhone('');
      setPurpose('');
      setPendingVisitor(null);
    } catch (err) {
      Alert.alert('Could not log visitor', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pendingItems = (pendingWalkIns.data?.items ?? []) as Visitor[];

  return (
    <GuardScreen
      eyebrow="Guard walk-in"
      title="Register walk-in visitor"
      subtitle="Use this for guests already at the guardhouse. Owner approval is requested when the condo policy requires it."
    >
      <Card style={[guardStyles.card, styles.policyCard]}>
        <View style={styles.policyIcon}>
          <Ionicons name="shield-checkmark-outline" size={20} color={GUARD_CORAL} />
        </View>
        <View style={styles.policyCopy}>
          <AppText style={styles.cardTitle}>{condo?.name ?? 'SmartResidence guardhouse'}</AppText>
          <AppText variant="meta" style={styles.cardMeta}>
            Walk-ins are one-time visits checked at the gate. Overnight visits should be
            pre-registered by the resident.
          </AppText>
        </View>
        <Pill
          tone={requireOwnerApproval ? 'warning' : 'success'}
          label={requireOwnerApproval ? `${approvalMinutes} min approval` : 'Direct check-in'}
        />
      </Card>

      <View style={[styles.layout, twoColumn ? styles.twoColumnLayout : null]}>
        <View style={styles.formColumn}>
          {pendingVisitor?.status === 'PENDING_OWNER_APPROVAL' ? (
            <PendingCard
              visitor={pendingVisitor}
              approvalMinutes={approvalMinutes}
              onCall={() => callOwner(pendingVisitor.ownerContacts)}
              onApprove={(method) => handleGuardApprove(pendingVisitor, method)}
              approving={approveWalkIn.isPending}
            />
          ) : null}

          <View style={styles.tabRail}>
            <Button
              title="To a unit"
              variant={tab === 'unit' ? 'primary' : 'secondary'}
              size="sm"
              style={styles.tabButton}
              onPress={() => setTab('unit')}
            />
            <Button
              title="Management office"
              variant={tab === 'office' ? 'primary' : 'secondary'}
              size="sm"
              style={styles.tabButton}
              onPress={() => setTab('office')}
            />
          </View>

          <Card style={[guardStyles.card, styles.formCard]}>
            <View style={styles.cardIntro}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name={tab === 'unit' ? 'home-outline' : 'business-outline'}
                  size={20}
                  color={GUARD_CORAL}
                />
              </View>
              <View style={styles.introCopy}>
                <AppText style={styles.cardTitle}>
                  {tab === 'unit' ? 'Unit visitor details' : 'Office visitor details'}
                </AppText>
                <AppText variant="meta" style={styles.cardMeta}>
                  {tab === 'unit'
                    ? 'Search the destination unit and record visitor contact details.'
                    : 'Record the visitor purpose before checking in to management.'}
                </AppText>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <AppText style={styles.fieldLabel}>Visitor name</AppText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={palette.mutedLight}
                returnKeyType="next"
                style={inputStyle}
              />
            </View>
            <View style={styles.fieldGroup}>
              <AppText style={styles.fieldLabel}>Phone number</AppText>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+60..."
                placeholderTextColor={palette.mutedLight}
                keyboardType="phone-pad"
                style={inputStyle}
              />
            </View>
            {tab === 'unit' ? (
              <>
                <UnitSearchPicker
                  condoId={condo?.id}
                  value={unit}
                  onChange={setUnit}
                  label="Destination unit"
                  placeholder="Search block, unit, or resident..."
                />
                <View style={styles.fieldGroup}>
                  <AppText style={styles.fieldLabel}>Purpose</AppText>
                  <TextInput
                    value={purpose}
                    onChangeText={setPurpose}
                    placeholder="Optional visiting reason"
                    placeholderTextColor={palette.mutedLight}
                    style={inputStyle}
                  />
                </View>
                <Button
                  title={
                    busy
                      ? 'Sending...'
                      : requireOwnerApproval
                        ? 'Request owner approval'
                        : 'Log and check in'
                  }
                  onPress={submitUnit}
                  loading={busy}
                />
              </>
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <AppText style={styles.fieldLabel}>Purpose</AppText>
                  <TextInput
                    value={purpose}
                    onChangeText={setPurpose}
                    placeholder="e.g. Parcel collection, AGM enquiry"
                    placeholderTextColor={palette.mutedLight}
                    style={inputStyle}
                  />
                </View>
                <Button
                  title={busy ? 'Logging...' : 'Log and check in'}
                  onPress={submitOffice}
                  loading={busy}
                />
              </>
            )}
          </Card>
        </View>

        <View style={styles.pendingColumn}>
          {requireOwnerApproval && pendingItems.length > 0 ? (
            <View style={styles.pendingList}>
              <GuardSectionHeader
                title="Awaiting owner approval"
                subtitle="Call the owner or approve once you have verified the visitor."
              />
              {pendingItems.map((v) => (
                <PendingCard
                  key={v.id}
                  visitor={v}
                  approvalMinutes={approvalMinutes}
                  onCall={() => callOwner(v.ownerContacts)}
                  onApprove={(method) => handleGuardApprove(v, method)}
                  approving={approveWalkIn.isPending}
                />
              ))}
            </View>
          ) : (
            <Card style={[guardStyles.card, styles.emptyCard]}>
              <View style={styles.emptyIcon}>
                <Ionicons name="checkmark-done-outline" size={22} color={GUARD_CORAL} />
              </View>
              <AppText style={styles.cardTitle}>No pending walk-ins</AppText>
              <AppText variant="meta" style={styles.cardMeta}>
                Visitors waiting for owner approval will appear here automatically.
              </AppText>
            </Card>
          )}
        </View>
      </View>
    </GuardScreen>
  );
}

function PendingCard({
  visitor,
  approvalMinutes,
  onCall,
  onApprove,
  approving,
}: {
  visitor: Visitor & { unit?: { identifier?: string } };
  approvalMinutes: number;
  onCall: () => void;
  onApprove: (method: GuardApprovalMethod) => void;
  approving: boolean;
}) {
  const contact = pickOwnerPhone(visitor.ownerContacts);
  const ownersWithPhone = visitor.ownerContacts?.filter((owner) => owner.phone?.trim()) ?? [];
  const visitorPhone = formatMalaysiaPhoneDisplay(visitor.phone, visitor.phoneCountryCode);

  return (
    <Card style={[guardStyles.card, styles.pendingCard]}>
      <View style={styles.pendingHeader}>
        <View style={styles.pendingIcon}>
          <Ionicons name="person-outline" size={18} color={GUARD_CORAL} />
        </View>
        <View style={styles.introCopy}>
          <AppText numberOfLines={2} style={styles.cardTitle}>
            {visitor.name}
          </AppText>
          <AppText variant="meta" style={styles.cardMeta}>
            {visitor.unit?.identifier ?? 'Unit'} · waiting for owner ({approvalMinutes} min)
          </AppText>
        </View>
      </View>

      <View style={styles.contactPanel}>
        <ContactLine
          label="Visitor phone"
          value={visitorPhone ?? 'Not provided'}
          onPress={
            visitorPhone
              ? () => callPhone(visitor.phone ?? '', visitor.name, visitor.phoneCountryCode)
              : undefined
          }
        />
        {ownersWithPhone.length > 0 ? (
          ownersWithPhone.map((owner) => (
            <ContactLine
              key={owner.id}
              label={owner.name}
              value={formatMalaysiaPhoneDisplay(owner.phone) ?? owner.phone ?? ''}
              onPress={() => callPhone(owner.phone ?? '', owner.name)}
            />
          ))
        ) : (
          <ContactLine label="Owner phone" value="No owner phone on file - contact management" />
        )}
      </View>

      <View style={styles.actionStack}>
        {contact?.phone ? (
          <Button title={`Call owner (${contact.name})`} variant="soft-sky" onPress={onCall} />
        ) : null}
        <Button
          title="Owner approved by phone"
          onPress={() => onApprove('OWNER_BY_PHONE')}
          loading={approving}
        />
        <Button
          title="Approve verified visitor"
          variant="secondary"
          onPress={() => onApprove('GUARD_MANUAL')}
          loading={approving}
        />
        <AppText variant="meta" style={styles.cardMeta}>
          Both actions check the visitor in immediately and add them to the live board.
        </AppText>
      </View>
    </Card>
  );
}

function ContactLine({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.contactLine}>
      <AppText variant="meta" style={styles.contactLabel}>
        {label}
      </AppText>
      <AppText style={[styles.contactValue, onPress ? styles.contactLink : null]} onPress={onPress}>
        {value}
      </AppText>
    </View>
  );
}

const inputStyle = {
  minHeight: 48,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.borderLight,
  backgroundColor: palette.surfaceLight,
  paddingHorizontal: 14,
  fontSize: 15,
  color: palette.textLight,
};

const styles = StyleSheet.create({
  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  policyIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyCopy: {
    flex: 1,
    minWidth: 0,
  },
  layout: {
    gap: spacing.md,
  },
  twoColumnLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formColumn: {
    flex: 1.05,
    minWidth: 0,
    gap: spacing.md,
  },
  pendingColumn: {
    flex: 0.95,
    minWidth: 0,
  },
  tabRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tabButton: {
    flexGrow: 1,
    minWidth: 128,
  },
  formCard: {
    gap: spacing.md,
  },
  cardIntro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_SKY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: palette.textLight,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
  },
  cardMeta: {
    color: palette.mutedLight,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    color: palette.textLight,
    fontWeight: '700',
  },
  pendingList: {
    gap: spacing.md,
  },
  pendingCard: {
    gap: spacing.md,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  pendingIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPanel: {
    borderRadius: radius.xl,
    backgroundColor: palette.bgLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  contactLine: {
    gap: 2,
  },
  contactLabel: {
    color: palette.mutedLight,
    fontWeight: '700',
  },
  contactValue: {
    color: palette.textLight,
    fontWeight: '700',
    lineHeight: 20,
  },
  contactLink: {
    color: GUARD_CORAL,
  },
  actionStack: {
    gap: spacing.xs,
  },
  emptyCard: {
    minHeight: 220,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_SKY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
