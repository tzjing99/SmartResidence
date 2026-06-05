import type * as React from 'react';
import { cn } from '../lib/cn';

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'rounded-xl bg-[rgb(var(--sr-border))]/30 bg-gradient-to-r from-[rgb(var(--sr-border))]/20 via-[rgb(var(--sr-border))]/45 to-[rgb(var(--sr-border))]/20 bg-[length:200%_100%] animate-shimmer',
      className,
    )}
    {...props}
  />
);
