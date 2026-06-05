import { GuardShell } from '@/components/guard-shell';
import type * as React from 'react';

export default function GuardLayout({ children }: { children: React.ReactNode }) {
  return <GuardShell>{children}</GuardShell>;
}
