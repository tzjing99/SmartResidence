import * as React from 'react';
import { cn } from '../lib/cn';

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('animate-pulse rounded-xl bg-[rgb(var(--sr-border))]/40', className)}
    {...props}
  />
);
