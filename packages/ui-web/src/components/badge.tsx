import { type VariantProps, cva } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-full h-6 px-2.5 text-xs font-medium leading-none whitespace-nowrap border border-transparent [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral:
          'bg-stone-100/90 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300 border-stone-200/60 dark:border-stone-700/40',
        primary:
          'bg-coral-50 dark:bg-coral-950/40 text-coral-700 dark:text-coral-300 border-coral-200/50 dark:border-coral-800/40',
        success:
          'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40',
        warning:
          'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/40',
        danger:
          'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200/50 dark:border-red-800/40',
        info: 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200/50 dark:border-sky-800/40',
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
