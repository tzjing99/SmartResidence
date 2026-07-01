'use client';

import * as React from 'react';
import { cn } from '../lib/cn';

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'type'> {
  /** Whether the switch is on. */
  checked: boolean;
  /** Called with the next checked state when the user toggles. */
  onCheckedChange?: (checked: boolean) => void;
  /** Accessible label when no visible label is associated. */
  'aria-label'?: string;
}

/**
 * Minimal accessible on/off toggle. Renders a `role="switch"` button so it works
 * with keyboard and screen readers, and follows the coral accent conventions.
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--sr-coral))] disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[rgb(var(--sr-coral))]' : 'bg-[rgb(var(--sr-border))]',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  ),
);
Switch.displayName = 'Switch';
