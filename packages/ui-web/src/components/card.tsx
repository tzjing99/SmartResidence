import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../lib/cn';

export const Card = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ className, ...props }, ref) => (
    <motion.div
      ref={ref}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={cn('sr-card p-6', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 mb-4', className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-semibold tracking-tight', className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm sr-muted', className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('text-sm', className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between pt-4 mt-4 border-t border-[rgb(var(--sr-border))]', className)} {...props} />
);
