import { ApiError } from '@smartresidence/api-client';
import { isAccessRestrictedArrearsError } from '@smartresidence/shared-types';
import { Alert } from 'react-native';

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError || err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}

export function isArrearsAccessError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return isAccessRestrictedArrearsError(err) || isAccessRestrictedArrearsError(err.body);
  }
  return isAccessRestrictedArrearsError(err);
}

/** Alert for resident mutations; arrears soft-blocks offer a Pay now action. */
export function alertResidentMutationError(
  err: unknown,
  opts: {
    title: string;
    arrearsTitle: string;
    arrearsBody: string;
    payLabel: string;
    dismissLabel?: string;
    onPay: () => void;
  },
): void {
  if (isArrearsAccessError(err)) {
    Alert.alert(opts.arrearsTitle, opts.arrearsBody, [
      { text: opts.dismissLabel ?? 'Not now', style: 'cancel' },
      { text: opts.payLabel, onPress: opts.onPay },
    ]);
    return;
  }
  Alert.alert(opts.title, getApiErrorMessage(err));
}
