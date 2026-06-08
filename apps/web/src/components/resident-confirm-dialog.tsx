'use client';

import { Button, Card } from '@smartresidence/ui-web';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

const MotionDialog = motion.create('dialog');

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
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="resident-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          <button
            type="button"
            aria-label={cancelLabel}
            className="absolute inset-0 bg-black/45 backdrop-blur-md"
            onClick={onCancel}
          />
          <MotionDialog
            open
            aria-labelledby="resident-confirm-title"
            className="relative z-10 m-0 w-full max-w-md border-0 bg-transparent p-0 shadow-none"
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
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
          </MotionDialog>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
