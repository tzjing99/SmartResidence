import { type VisitorPassShareInput, passKindLabel } from '@smartresidence/shared-types';
import { Button, radius, spacing, useTheme } from '@smartresidence/ui-mobile';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { useT } from '../i18n/locale-provider';
import { hapticSuccess } from '../lib/haptics';
import { shareVisitorPassImage } from '../lib/visitor-pass-share';
import { SharePassCard, type SharePassCardProps, formatSharePassValidity } from './share-pass-card';

export type SharePassSheetProps = {
  visible: boolean;
  onClose: () => void;
  input: VisitorPassShareInput;
  qrPayload: string;
  passKind?: string | null;
};

export function SharePassSheet({
  visible,
  onClose,
  input,
  qrPayload,
  passKind,
}: SharePassSheetProps) {
  const t = useT();
  const { colors } = useTheme();
  const cardRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) setCopied(false);
  }, [visible]);

  const passTypeLabel = passKind ? passKindLabel(passKind) : 'Visitor pass';

  const cardProps: SharePassCardProps = {
    visitorName: input.visitorName,
    accessCode: input.accessCode,
    qrPayload,
    unitIdentifier: input.unitIdentifier,
    passTypeLabel,
    validityLabel: formatSharePassValidity(input.expectedAt, input.expiresAt),
    colors,
  };

  async function handleShare() {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await shareVisitorPassImage(uri, input);
      onClose();
    } catch (err) {
      const message = (err as Error).message;
      if (message !== 'User did not share') {
        Alert.alert(t('visitors.pass.shareFailedTitle'), message);
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyCode() {
    await Clipboard.setStringAsync(input.accessCode);
    await hapticSuccess();
    setCopied(true);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.bg,
            borderRadius: radius['2xl'],
            padding: spacing.lg,
            gap: spacing.lg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            alignItems: 'center',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }}>
            <SharePassCard {...cardProps} />
          </ViewShot>

          <View style={{ width: '100%', gap: spacing.sm }}>
            <Button
              title={sharing ? 'Sharing…' : 'Share'}
              size="lg"
              loading={sharing}
              onPress={handleShare}
            />
            <Button
              title={copied ? 'Code copied' : 'Copy access code'}
              variant="ghost"
              size="sm"
              onPress={handleCopyCode}
            />
            <Button title="Cancel" variant="secondary" size="sm" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
