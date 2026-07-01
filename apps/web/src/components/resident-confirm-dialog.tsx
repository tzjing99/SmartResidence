'use client';

import { Button, Card, Dialog } from '@smartresidence/ui-web';
import type { ReactNode } from 'react';

type ResidentConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmPending?: boolean;
  confirmVariant?: 'primary' | 'destructive';
  children?: ReactNode;
};

export function ResidentConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmPending,
  confirmVariant = 'primary',
  children,
}: ResidentConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      labelledBy="resident-confirm-title"
      closeLabel={cancelLabel}
    >
      <Card className="rounded-2xl p-0 shadow-2xl ring-1 ring-black/5">
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h3 id="resident-confirm-title" className="text-lg font-semibold tracking-tight">
              {title}
            </h3>
            {description ? (
              <p className="text-sm sr-muted mt-2 leading-relaxed">{description}</p>
            ) : null}
          </div>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onCancel} disabled={confirmPending}>
              {cancelLabel}
            </Button>
            <Button variant={confirmVariant} onClick={onConfirm} disabled={confirmPending}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Card>
    </Dialog>
  );
}
