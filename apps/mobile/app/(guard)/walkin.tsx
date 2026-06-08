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
import { Button, Card, palette, radius } from '@smartresidence/ui-mobile';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Linking, ScrollView, Text, TextInput, View } from 'react-native';
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
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();
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
          gap: 16,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Walk-in visitor</Text>
        {condo ? (
          <Text style={{ color: palette.mutedLight, fontSize: 12 }}>{condo.name}</Text>
        ) : null}
        <Text style={{ color: palette.mutedLight, fontSize: 14 }}>
          One visit — validated once at the gate. Security opens the gate; the owner meets the
          visitor. Overnight stays are not available for walk-ins — use pre-registration instead.
        </Text>

        {pendingVisitor?.status === 'PENDING_OWNER_APPROVAL' ? (
          <PendingCard
            visitor={pendingVisitor}
            approvalMinutes={approvalMinutes}
            onCall={() => callOwner(pendingVisitor.ownerContacts)}
            onApprove={(method) => handleGuardApprove(pendingVisitor, method)}
            approving={approveWalkIn.isPending}
          />
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Unit"
            variant={tab === 'unit' ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setTab('unit')}
          />
          <Button
            title="Management office"
            variant={tab === 'office' ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setTab('office')}
          />
        </View>

        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>Visitor name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            style={inputStyle}
          />
          <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 6 }}>Phone number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+60…"
            keyboardType="phone-pad"
            style={inputStyle}
          />
          {tab === 'unit' ? (
            <>
              <View style={{ marginTop: 12 }}>
                <UnitSearchPicker
                  condoId={condo?.id}
                  value={unit}
                  onChange={setUnit}
                  label="Unit"
                  placeholder="Search block, unit, or resident…"
                />
              </View>
              <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 6 }}>
                Purpose (optional)
              </Text>
              <TextInput
                value={purpose}
                onChangeText={setPurpose}
                placeholder="Visiting reason"
                style={inputStyle}
              />
              <View style={{ marginTop: 16 }}>
                <Button
                  title={
                    busy
                      ? 'Sending…'
                      : requireOwnerApproval
                        ? 'Request owner approval'
                        : 'Log & check in'
                  }
                  onPress={submitUnit}
                  loading={busy}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 6 }}>
                Purpose (required)
              </Text>
              <TextInput
                value={purpose}
                onChangeText={setPurpose}
                placeholder="e.g. Parcel collection, AGM enquiry"
                style={inputStyle}
              />
              <View style={{ marginTop: 16 }}>
                <Button
                  title={busy ? 'Logging…' : 'Log & check in'}
                  onPress={submitOffice}
                  loading={busy}
                />
              </View>
            </>
          )}
        </Card>

        {requireOwnerApproval && pendingItems.length > 0 ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>Awaiting owner approval</Text>
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
        ) : null}
      </View>
    </ScrollView>
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
    <Card>
      <Text style={{ fontWeight: '700' }}>{visitor.name}</Text>
      <Text style={{ color: palette.mutedLight, fontSize: 12, marginTop: 4 }}>
        {visitor.unit?.identifier ?? 'Unit'} · waiting for owner ({approvalMinutes} min window)
      </Text>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Text
          style={{ fontSize: 11, fontWeight: '600', color: palette.mutedLight, letterSpacing: 0.5 }}
        >
          CONTACTS
        </Text>

        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, color: palette.mutedLight }}>Visitor phone</Text>
          {visitorPhone ? (
            <Text
              style={{ fontSize: 14, color: palette.coralPrimary, fontWeight: '600' }}
              onPress={() => callPhone(visitor.phone ?? '', visitor.name, visitor.phoneCountryCode)}
            >
              {visitorPhone}
            </Text>
          ) : (
            <Text style={{ fontSize: 14, color: palette.mutedLight }}>Not provided</Text>
          )}
        </View>

        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, color: palette.mutedLight }}>Owner phone</Text>
          {ownersWithPhone.length > 0 ? (
            ownersWithPhone.map((owner) => (
              <Text
                key={owner.id}
                style={{ fontSize: 14, color: palette.coralPrimary, fontWeight: '600' }}
                onPress={() => callPhone(owner.phone ?? '', owner.name)}
              >
                {owner.name} · {formatMalaysiaPhoneDisplay(owner.phone) ?? owner.phone}
              </Text>
            ))
          ) : (
            <Text style={{ fontSize: 14, color: palette.mutedLight }}>
              No owner phone on file — contact management
            </Text>
          )}
        </View>

        {contact?.phone ? (
          <Button title={`Call owner (${contact.name})`} variant="secondary" onPress={onCall} />
        ) : null}
      </View>

      <View style={{ marginTop: 14, gap: 8 }}>
        <Button
          title="Owner approved by phone"
          onPress={() => onApprove('OWNER_BY_PHONE')}
          loading={approving}
        />
        <Button
          title="Approve (verified visitor)"
          variant="secondary"
          onPress={() => onApprove('GUARD_MANUAL')}
          loading={approving}
        />
        <Text style={{ fontSize: 12, color: palette.mutedLight }}>
          Both open the gate now and add the visitor to the live board — no waiting on the app.
        </Text>
      </View>
    </Card>
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
