'use client';

import { type HTMLMotionProps, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { cn } from '../lib/cn';
import { iosSpring, tapScale, tapTransition } from '../motion';

export const Card = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ className, ...props }, ref) => {
    const reduceMotion = useReducedMotion();
    return (
      <motion.div
        ref={ref}
        whileHover={reduceMotion ? undefined : { y: -2 }}
        whileTap={reduceMotion ? undefined : { scale: tapScale }}
        transition={{
          scale: tapTransition,
          y: reduceMotion ? tapTransition : iosSpring.snappy,
        }}
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
