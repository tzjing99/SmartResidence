import { type ExternalToast, toast as sonner } from 'sonner';

/** Shared toast durations (ms) — success/info auto-dismiss; errors linger slightly longer. */
export const TOAST_DURATION = {
  success: 3500,
  info: 4000,
  error: 6500,
} as const;

function withDefaults(defaults: ExternalToast, opts?: ExternalToast): ExternalToast {
  return { ...defaults, ...opts };
}

type ToastMessage = Parameters<typeof sonner>[0];

export const toast = Object.assign(
  (message: ToastMessage, opts?: ExternalToast) =>
    sonner(message, withDefaults({ duration: TOAST_DURATION.info }, opts)),
  {
    success: (message: ToastMessage, opts?: ExternalToast) =>
      sonner.success(message, withDefaults({ duration: TOAST_DURATION.success }, opts)),
    error: (message: ToastMessage, opts?: ExternalToast) =>
      sonner.error(
        message,
        withDefaults({ duration: TOAST_DURATION.error, closeButton: true }, opts),
      ),
    message: (message: ToastMessage, opts?: ExternalToast) =>
      sonner.message(message, withDefaults({ duration: TOAST_DURATION.info }, opts)),
    info: sonner.info,
    warning: sonner.warning,
    loading: sonner.loading,
    promise: sonner.promise,
    custom: sonner.custom,
    dismiss: sonner.dismiss,
  },
);
