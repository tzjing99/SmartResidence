import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--sr-coral))] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-[rgb(var(--sr-coral))] text-[rgb(var(--sr-coral-fg))] hover:brightness-105 shadow-[0_2px_6px_-1px_rgba(255,90,95,0.4)]',
        secondary:
          'bg-[rgb(var(--sr-card))] text-[rgb(var(--sr-fg))] border border-[rgb(var(--sr-border))] hover:bg-[rgb(var(--sr-bg))]',
        ghost: 'hover:bg-[rgb(var(--sr-border))]/50 text-[rgb(var(--sr-fg))]',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        link: 'text-[rgb(var(--sr-coral))] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 rounded-lg px-3 text-sm',
        md: 'h-11 rounded-xl px-4 text-sm',
        lg: 'h-12 rounded-xl px-6 text-base',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';
