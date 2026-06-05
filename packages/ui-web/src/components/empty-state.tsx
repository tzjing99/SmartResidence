'use client';

import { motion } from 'framer-motion';
import type * as React from 'react';
import { cn } from '../lib/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({ icon, title, description, action, className }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 220, damping: 26 }}
    className={cn(
      'flex flex-col items-center justify-center rounded-3xl border border-dashed border-[rgb(var(--sr-border))] p-12 text-center',
      className,
    )}
  >
    {icon ? <div className="mb-4 text-[rgb(var(--sr-muted))]">{icon}</div> : null}
    <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
    {description ? <p className="mt-1 text-sm sr-muted max-w-sm">{description}</p> : null}
    {action ? <div className="mt-6">{action}</div> : null}
  </motion.div>
);
