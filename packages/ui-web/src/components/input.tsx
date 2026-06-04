import * as React from 'react';
import { cn } from '../lib/cn';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-11 w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] px-4 text-sm transition-colors placeholder:text-[rgb(var(--sr-muted))] focus:border-[rgb(var(--sr-coral))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--sr-coral))]/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('text-sm font-medium', className)} {...props} />
  ),
);
Label.displayName = 'Label';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[120px] w-full rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] p-4 text-sm transition-colors placeholder:text-[rgb(var(--sr-muted))] focus:border-[rgb(var(--sr-coral))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--sr-coral))]/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
