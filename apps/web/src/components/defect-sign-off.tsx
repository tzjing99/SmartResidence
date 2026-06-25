'use client';

import {
  DEFECT_SIGN_OFF_CONFIRM_LABEL,
  DEFECT_SIGN_OFF_MESSAGE,
  DEFECT_SIGN_OFF_PROMPT_LABEL,
  DEFECT_SIGN_OFF_TITLE,
  defectBulkSignOffMessage,
} from '@smartresidence/shared-types';
import { Button } from '@smartresidence/ui-web';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import * as React from 'react';

type SignOffActionsProps = {
  disabled?: boolean;
  pending?: boolean;
  onSignOff: () => void | Promise<void>;
  onReject?: () => void | Promise<void>;
  /** Hide the helper line above the buttons (e.g. when the parent already explains). */
  hideHint?: boolean;
};

export function DefectSignOffActions({
  disabled,
  pending,
  onSignOff,
  onReject,
  hideHint,
}: SignOffActionsProps) {
  const [confirming, setConfirming] = React.useState(false);

  async function confirm() {
    await onSignOff();
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-3 space-y-3">
        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          {DEFECT_SIGN_OFF_TITLE}
        </p>
        <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
          {DEFECT_SIGN_OFF_MESSAGE}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={pending} onClick={() => void confirm()}>
            {pending ? 'Signing off…' : DEFECT_SIGN_OFF_CONFIRM_LABEL}
          </Button>
          <Button size="sm" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!hideHint ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Fixed by management — sign off if the repair is acceptable, or reject if more work is
          needed.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={disabled || pending}
          onClick={() => setConfirming(true)}
        >
          <ThumbsUp className="size-3.5" />
          {DEFECT_SIGN_OFF_PROMPT_LABEL}
        </Button>
        {onReject ? (
          <Button size="sm" disabled={disabled || pending} onClick={() => void onReject()}>
            <ThumbsDown className="size-3.5" />
            Reject — needs more work
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type BulkSignOffProps = {
  count: number;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function DefectBulkSignOffButton({ count, pending, onConfirm }: BulkSignOffProps) {
  const [confirming, setConfirming] = React.useState(false);

  async function confirm() {
    await onConfirm();
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="w-full min-w-[min(100%,20rem)] space-y-3 text-left">
        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          {DEFECT_SIGN_OFF_TITLE}
        </p>
        <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
          {defectBulkSignOffMessage(count)}
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button size="sm" variant="primary" disabled={pending} onClick={() => void confirm()}>
            {pending ? 'Signing off…' : DEFECT_SIGN_OFF_CONFIRM_LABEL}
          </Button>
          <Button size="sm" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="primary" disabled={pending} onClick={() => setConfirming(true)}>
      <ThumbsUp className="size-4" />
      {pending ? 'Signing off…' : `Sign off all (${count})`}
    </Button>
  );
}
