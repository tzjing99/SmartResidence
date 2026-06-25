import {
  formatHandoverSubmissionDuration,
  handoverReportEstimateSeconds,
  handoverSubmissionStatusMessage,
} from '@smartresidence/shared-types';
import { AppText, palette, radius } from '@smartresidence/ui-mobile';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';

interface DefectSubmissionProgressProps {
  visible: boolean;
  itemCount: number;
  complete?: boolean;
}

export function DefectSubmissionProgress({
  visible,
  itemCount,
  complete = false,
}: DefectSubmissionProgressProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const estimateSec = handoverReportEstimateSeconds(itemCount);

  useEffect(() => {
    if (!visible) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - started), 250);
    return () => clearInterval(id);
  }, [visible]);

  const progress = complete ? 100 : Math.min(95, (elapsedMs / 1000 / estimateSec) * 100);
  const remainingSec = Math.max(0, estimateSec - elapsedMs / 1000);
  const statusMessage = handoverSubmissionStatusMessage(itemCount, elapsedMs, complete);
  const showRemaining = !complete && remainingSec >= 4 && progress < 92;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: palette.surfaceLight,
            borderRadius: radius.xl,
            padding: 20,
            borderWidth: 1,
            borderColor: palette.borderLight,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            {complete ? (
              <AppText style={{ fontSize: 22 }}>✓</AppText>
            ) : (
              <ActivityIndicator color={palette.coralPrimary} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={{ fontWeight: '700', fontSize: 17, color: palette.textLight }}>
                {complete ? 'Submitted!' : 'Submitting your defects'}
              </AppText>
              <AppText variant="meta" style={{ color: palette.mutedLight, marginTop: 4 }}>
                {itemCount === 1 ? '1 defect' : `${itemCount} defects`} in this report
              </AppText>
            </View>
          </View>

          <AppText style={{ color: palette.textLight, fontSize: 14, lineHeight: 20 }}>
            {statusMessage}
          </AppText>

          {!complete ? (
            <AppText variant="meta" style={{ color: palette.mutedLight }}>
              Usually takes {formatHandoverSubmissionDuration(estimateSec)}
              {showRemaining ? ` · roughly ${Math.ceil(remainingSec)}s left` : ''}
            </AppText>
          ) : null}

          <View
            style={{
              height: 8,
              borderRadius: 999,
              backgroundColor: palette.borderLight,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${progress}%`,
                borderRadius: 999,
                backgroundColor: complete ? '#10B981' : palette.coralPrimary,
              }}
            />
          </View>

          {!complete ? (
            <AppText variant="meta" style={{ color: palette.mutedLight, lineHeight: 18 }}>
              Please keep this screen open until you see confirmation.
            </AppText>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
