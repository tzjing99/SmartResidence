import { AppShell } from '@/components/app-shell';
import type * as React from 'react';

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
