import { type VariantProps, cva } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-full h-6 px-2.5 text-xs font-medium leading-none [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-[rgb(var(--sr-border))]/40 text-[rgb(var(--sr-fg))]',
        primary: 'bg-[rgb(var(--sr-coral))]/15 text-[rgb(var(--sr-coral))]',
        success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
        info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, tone, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ tone }), className)} {...props} />
);
