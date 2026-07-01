import { Ionicons } from '@expo/vector-icons';
import { isVisitorBlacklistError } from '@smartresidence/shared-types';
import { AppText, Button, Card, palette, radius, spacing } from '@smartresidence/ui-mobile';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInput as TextInputType,
  View,
} from 'react-native';
import {
  GUARD_CORAL,
  GUARD_SOFT_CORAL,
  GUARD_SOFT_SKY,
  GuardScreen,
  guardStyles,
} from '../../src/components/guard-screen';
import {
  type GuardVerifiedVisitor,
  VisitorGuardPassCard,
} from '../../src/components/visitor-guard-pass';
import { api } from '../../src/lib/api';
import { enqueueCheckIn } from '../../src/lib/guard-queue';
import { useTabletLayout } from '../../src/lib/use-tablet-layout';

const ACCESS_CODE_LENGTH = 6;
const ACCESS_CODE_CHARS = Array.from({ length: ACCESS_CODE_LENGTH }, (_, index) => index);
const ACCESS_CODE_FILTER = /[^A-Z0-9]/g;

function normalizeAccessCode(value: string) {
  return value.toUpperCase().replace(ACCESS_CODE_FILTER, '').slice(0, ACCESS_CODE_LENGTH);
}

function isServerError(err: unknown) {
  return err instanceof Error && err.name === 'ApiError';
}

export default function ManualScreen() {
  const { twoColumn } = useTabletLayout();
  const inputRef = useRef<TextInputType>(null);
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [visitor, setVisitor] = useState<GuardVerifiedVisitor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (code.length === ACCESS_CODE_LENGTH && !busy) {
      void verifyAndCheckIn(code);
    }
  }, [busy, code]);

  function handleCodeChange(value: string) {
    setCode(normalizeAccessCode(value));
    setError(null);
    setSuccess(null);
    setVisitor(null);
  }

  function resetCode() {
    setCode('');
    setError(null);
    setSuccess(null);
    setVisitor(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function showBlocked(message: string) {
    setError(message);
    setVisitor(null);
    setCode('');
    Alert.alert('Visitor blocked', message);
  }

  /** Fall back to a recurring pass when the code is not a one-off visitor pass. */
  async function tryRecurringCheckIn(pass: string): Promise<boolean> {
    try {
      const recurring = await api.verifyRecurringPass(pass);
      if (!recurring.withinSchedule) {
        const message = recurring.scheduleMessage ?? 'This recurring pass is not valid right now.';
        setError(message);
        setCode('');
        Alert.alert('Outside schedule', message);
        return true;
      }
      await api.checkInRecurringPass(pass, { gateLocation: 'Main gate (manual)', notes });
      setSuccess(`${recurring.guestName} checked in.`);
      Alert.alert('Checked in', `${recurring.guestName} (recurring pass) is now on-site.`);
      setCode('');
      setNotes('');
      return true;
    } catch (err) {
      const message = (err as Error).message;
      if (isVisitorBlacklistError(message)) {
        showBlocked(message);
        return true;
      }
      return false;
    }
  }

  async function verifyAndCheckIn(pass: string) {
    if (busy || pass.length !== ACCESS_CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    let verifiedVisitor: GuardVerifiedVisitor | null = null;
    try {
      verifiedVisitor = (await api.verifyQr(pass)) as GuardVerifiedVisitor;
      await api.checkInVisitor(pass, {
        gateLocation: 'Main gate (manual)',
        notes,
      });
      setVisitor(verifiedVisitor);
      setSuccess(`${verifiedVisitor.name} checked in.`);
      Alert.alert('Checked in', `${verifiedVisitor.name} is now on-site.`);
      setCode('');
      setNotes('');
    } catch (err) {
      const message = (err as Error).message;

      // Blacklisted visitors are blocked at the gate regardless of pass type.
      if (isVisitorBlacklistError(message)) {
        showBlocked(message);
        return;
      }

      if (!verifiedVisitor) {
        // Not a one-off pass — it may be a recurring pass access code.
        const handled = await tryRecurringCheckIn(pass);
        if (handled) return;
        setError('Access code not valid. Please check the visitor pass and try again.');
        setCode('');
        setVisitor(null);
        return;
      }

      if (!isServerError(err)) {
        await enqueueCheckIn({
          qrCode: pass,
          gateLocation: 'Main gate (manual)',
          notes,
        });
        setSuccess('Check-in queued. It will sync when the network is back.');
        Alert.alert('Queued', 'Network unavailable — will sync when online.');
        setCode('');
        setNotes('');
        return;
      }

      setError(message);
      setCode('');
      setVisitor(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GuardScreen
      eyebrow="Guard manual entry"
      title="Enter access code"
      subtitle="Type the six-character visitor code. SmartResidence verifies and checks in automatically when the code is complete."
    >
      <View style={[styles.layout, twoColumn ? styles.twoColumnLayout : null]}>
        <View style={styles.column}>
          <Card style={[guardStyles.card, styles.formCard]}>
            <View style={styles.cardIntro}>
              <View style={styles.iconBubble}>
                <Ionicons name="keypad-outline" size={20} color={GUARD_CORAL} />
              </View>
              <View style={styles.introCopy}>
                <AppText style={styles.cardTitle}>Access code</AppText>
                <AppText variant="meta" style={styles.cardMeta}>
                  Tap the boxes and enter the code from the pass. Letters are accepted because
                  generated visitor codes are alphanumeric.
                </AppText>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <AppText style={styles.fieldLabel}>Six-character code</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Access code entry"
                accessibilityHint="Opens the keyboard for entering the visitor access code."
                onPress={() => inputRef.current?.focus()}
                style={[styles.codePad, error ? styles.codePadError : null]}
              >
                <View style={styles.codeRow}>
                  {ACCESS_CODE_CHARS.map((index) => {
                    const value = code[index] ?? '';
                    const active = index === code.length && !busy;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.codeBox,
                          active ? styles.codeBoxActive : null,
                          value ? styles.codeBoxFilled : null,
                        ]}
                      >
                        <AppText style={styles.codeText}>{value}</AppText>
                      </View>
                    );
                  })}
                </View>
                <TextInput
                  ref={inputRef}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  value={code}
                  onChangeText={handleCodeChange}
                  editable={!busy}
                  returnKeyType="done"
                  style={styles.hiddenInput}
                />
              </Pressable>
              <View style={styles.statusRow}>
                {busy ? (
                  <>
                    <ActivityIndicator color={GUARD_CORAL} size="small" />
                    <AppText variant="meta" style={styles.statusText}>
                      Verifying and checking in…
                    </AppText>
                  </>
                ) : (
                  <AppText
                    variant="meta"
                    style={[styles.statusText, error ? styles.errorText : null]}
                  >
                    {error ??
                      'Auto-submits after the sixth character. Enter notes before the final character if needed.'}
                  </AppText>
                )}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <AppText style={styles.fieldLabel}>Gate notes</AppText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional handover note"
                placeholderTextColor={palette.mutedLight}
                style={[inputStyle, styles.notesInput]}
                multiline
              />
            </View>

            <Button
              title={code || error ? 'Clear code' : 'Ready for code'}
              variant={code || error || success ? 'secondary' : 'soft-primary'}
              onPress={resetCode}
              disabled={busy}
            />
          </Card>
        </View>

        <View style={styles.column}>
          {success ? (
            <Card style={[guardStyles.card, styles.successCard]}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={24} color="#047857" />
              </View>
              <AppText style={styles.cardTitle}>{success}</AppText>
              <AppText variant="meta" style={styles.cardMeta}>
                The code entry is ready for the next visitor.
              </AppText>
              {visitor ? <VisitorGuardPassCard visitor={visitor} /> : null}
            </Card>
          ) : (
            <Card style={[guardStyles.card, styles.emptyCard]}>
              <View style={styles.emptyIcon}>
                <Ionicons name="person-circle-outline" size={24} color={GUARD_CORAL} />
              </View>
              <AppText style={styles.cardTitle}>Waiting for code</AppText>
              <AppText variant="meta" style={styles.cardMeta}>
                Visitor check-in starts automatically once all six characters are entered.
              </AppText>
            </Card>
          )}
        </View>
      </View>
    </GuardScreen>
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
  layout: {
    gap: spacing.md,
  },
  twoColumnLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
  },
  formCard: {
    gap: spacing.md,
  },
  cardIntro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: GUARD_SOFT_CORAL,
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
  codePad: {
    minHeight: 82,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: palette.borderLight,
    backgroundColor: palette.surfaceLight,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  codePadError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.borderLight,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: {
    borderColor: GUARD_CORAL,
  },
  codeBoxFilled: {
    borderColor: 'rgba(255,90,95,0.36)',
    backgroundColor: GUARD_SOFT_CORAL,
  },
  codeText: {
    color: palette.textLight,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  statusRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    flex: 1,
    color: palette.mutedLight,
    lineHeight: 20,
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  successCard: {
    gap: spacing.sm,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
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
