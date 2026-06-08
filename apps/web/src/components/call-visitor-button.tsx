'use client';

import { useT } from '@/i18n/locale-provider';
import {
  formatMalaysiaPhoneDisplay,
  malaysiaPhoneTelHref,
} from '@smartresidence/shared-types';
import { Button } from '@smartresidence/ui-web';
import { Phone } from 'lucide-react';

type CallVisitorButtonProps = {
  phone?: string | null;
  phoneCountryCode?: string | null;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  className?: string;
};

export function CallVisitorButton({
  phone,
  phoneCountryCode,
  variant = 'primary',
  size = 'md',
  className,
}: CallVisitorButtonProps) {
  const t = useT();
  const display = formatMalaysiaPhoneDisplay(phone, phoneCountryCode);
  const href = malaysiaPhoneTelHref(phone, phoneCountryCode);

  if (!display || !href) {
    return <p className="text-xs sr-muted">{t('visitors.guard.phoneNotProvided')}</p>;
  }

  return (
    <Button variant={variant} size={size} className={className} asChild>
      <a href={href}>
        <Phone className="size-4" />
        {t('visitors.guard.callVisitor')} · {display}
      </a>
    </Button>
  );
}
