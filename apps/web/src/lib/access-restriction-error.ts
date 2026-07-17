import { ApiError } from '@smartresidence/api-client';
import { isAccessRestrictedArrearsError } from '@smartresidence/shared-types';
import { toast } from '@/lib/toast';

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

/**
 * Toast for resident mutations. Arrears soft-blocks get a clear "pay to unlock"
 * message with an action that navigates to billing.
 */
export function toastResidentMutationError(
  err: unknown,
  opts: {
    arrearsTitle: string;
    arrearsBody: string;
    payLabel: string;
    onPay: () => void;
  },
): void {
  if (isArrearsAccessError(err)) {
    toast.error(opts.arrearsTitle, {
      description: opts.arrearsBody,
      duration: 12_000,
      action: {
        label: opts.payLabel,
        onClick: opts.onPay,
      },
    });
    return;
  }
  toast.error(getApiErrorMessage(err));
}
