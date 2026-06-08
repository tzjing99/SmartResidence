'use client';

import { TOAST_DURATION } from '@/lib/toast';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';

/**
 * Guard kiosk/tablet shell keeps primary nav in the header (top-right). Toasts
 * there would cover Settings / Sign out, so gate routes use bottom-center.
 */
export function AppToaster() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const isGuard = pathname.startsWith('/guard');

  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position={isGuard ? 'bottom-center' : 'top-right'}
      offset={isGuard ? 24 : 16}
      duration={TOAST_DURATION.info}
      closeButton={false}
      visibleToasts={3}
      gap={10}
      className="sr-sonner"
      toastOptions={{
        classNames: {
          toast: 'sr-sonner-toast',
          title: 'sr-sonner-title',
          description: 'sr-sonner-description',
          closeButton: 'sr-sonner-close',
        },
      }}
    />
  );
}
