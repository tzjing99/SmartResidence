'use client';

import { type HTMLMotionProps, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { cn } from '../lib/cn';
import { tapTransition } from '../motion';

export type CardProps = HTMLMotionProps<'div'> & {
  /** Subtle press feedback for clickable cards (list rows, links). Default is static. */
  interactive?: boolean;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, ...props }, ref) => {
    const reduceMotion = useReducedMotion();
    return (
      <motion.div
        ref={ref}
        whileTap={interactive && !reduceMotion ? { opacity: 0.92 } : undefined}
        transition={interactive ? { opacity: tapTransition } : undefined}
        className={cn('sr-card p-6', className)}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 mb-4', className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-semibold tracking-tight', className)} {...props} />
);

export const CardDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm sr-muted', className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('text-sm', className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex items-center justify-between pt-4 mt-4 border-t border-[rgb(var(--sr-border))]',
      className,
    )}
    {...props}
  />
);
