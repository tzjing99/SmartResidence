import {
  DEFECT_SIGN_OFF_CONFIRM_LABEL,
  DEFECT_SIGN_OFF_MESSAGE,
  DEFECT_SIGN_OFF_TITLE,
  defectBulkSignOffMessage,
} from '@smartresidence/shared-types';
import { Alert } from 'react-native';

/** Two-step sign-off: show irreversible notice, then run onConfirm. */
export function confirmDefectSignOff(onConfirm: () => void | Promise<void>) {
  Alert.alert(DEFECT_SIGN_OFF_TITLE, DEFECT_SIGN_OFF_MESSAGE, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: DEFECT_SIGN_OFF_CONFIRM_LABEL,
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}

export function confirmDefectBulkSignOff(count: number, onConfirm: () => void | Promise<void>) {
  Alert.alert(DEFECT_SIGN_OFF_TITLE, defectBulkSignOffMessage(count), [
    { text: 'Cancel', style: 'cancel' },
    {
      text: DEFECT_SIGN_OFF_CONFIRM_LABEL,
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
