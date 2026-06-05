'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/cn';

export type SelectOption = { value: string; label: string };

export type SelectProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  className?: string;
  'aria-label'?: string;
  placeholder?: string;
};

/** Portal-backed select — avoids native `<select>` clipping inside cards and overflow containers. */
export function Select({
  id,
  value,
  onValueChange,
  options,
  className,
  'aria-label': ariaLabel,
  placeholder = 'Select…',
}: SelectProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        id={id}
        type="button"
        aria-label={ariaLabel}
        className={cn(
          'sr-select flex w-full items-center justify-between gap-2 text-left',
          className,
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto rounded-xl border border-[rgb(var(--sr-border))] bg-white p-1 shadow-lg dark:bg-[rgb(var(--sr-card))]"
          sideOffset={4}
          align="start"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <DropdownMenu.Item
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors',
                  active
                    ? 'bg-[rgb(var(--sr-coral)/0.1)] font-medium text-[rgb(var(--sr-coral))]'
                    : 'text-[rgb(var(--sr-fg))] hover:bg-[rgb(var(--sr-bg))] focus:bg-[rgb(var(--sr-bg))]',
                )}
                onSelect={() => onValueChange(opt.value)}
              >
                <span>{opt.label}</span>
                {active ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn('sr-select', className)} {...props}>
    {children}
  </select>
));
NativeSelect.displayName = 'NativeSelect';
