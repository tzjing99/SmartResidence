'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import * as React from 'react';
import { cn } from '../lib/cn';
import { iosSpring } from '../motion';

const MotionDialog = motion.create('dialog');

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex !== -1 && !el.hasAttribute('disabled') && el.getClientRects().length > 0,
  );
}

export interface DialogProps {
  open: boolean;
  /** Omit for a non-dismissible dialog (e.g. a blocking progress modal). */
  onClose?: () => void;
  labelledBy: string;
  children: ReactNode;
  /** Panel sizing/layout classes — merged with sane defaults (width, no border/shadow on the native <dialog>). */
  className?: string;
  overlayClassName?: string;
  /** Defaults to `z-50`; pass `z-40` etc. for stacked dialogs under another overlay. */
  zIndexClassName?: string;
  closeLabel?: string;
  lockScroll?: boolean;
  closeOnEscape?: boolean;
}

/**
 * Shared animated dialog — backdrop fade + panel scale/rise, tuned to the same
 * curves everywhere so every modal in the app feels identical. Wraps a native
 * `<dialog>` element (via framer-motion) for top-layer stacking, with an overlay
 * focus trap (backdrop + panel). Content is up to the caller (usually a `Card`).
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
  className,
  overlayClassName,
  zIndexClassName = 'z-50',
  closeLabel = 'Close dialog',
  lockScroll = true,
  closeOnEscape = true,
}: DialogProps) {
  const reduceMotion = useReducedMotion();
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const trapRoot = overlayRef.current;
    if (!trapRoot) return;
    const root: HTMLDivElement = trapRoot;

    const focusTimer = window.setTimeout(() => {
      const panel = root.querySelector('dialog');
      const focusables = getFocusable(root);
      const firstInPanel = focusables.find((el) => panel?.contains(el));
      (firstInPanel ?? focusables[0])?.focus();
    }, 0);

    function trapTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(root);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', trapTab);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', trapTab);
      previouslyFocused.current?.focus();
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, lockScroll]);

  React.useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return;
    const close = onClose;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onClose]);

  const overlayTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };
  const panelTransition = reduceMotion ? { duration: 0 } : iosSpring.snappy;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={overlayRef}
          className={cn(
            'fixed inset-0 flex items-center justify-center p-4 sm:p-6',
            zIndexClassName,
            overlayClassName,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={overlayTransition}
        >
          {onClose ? (
            <button
              type="button"
              aria-label={closeLabel}
              className="absolute inset-0 bg-black/45 backdrop-blur-md"
              onClick={onClose}
            />
          ) : (
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
          )}
          <MotionDialog
            open
            aria-labelledby={labelledBy}
            aria-modal="true"
            className={cn(
              'relative z-10 m-0 w-full max-w-md border-0 bg-transparent p-0 shadow-none',
              className,
            )}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8 }}
            transition={panelTransition}
          >
            {children}
          </MotionDialog>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
