import * as React from 'react';
import { AppShell } from '@/components/app-shell';

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
