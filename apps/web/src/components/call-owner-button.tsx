'use client';

import { useT } from '@/i18n/locale-provider';
import { type WalkInOwnerContact, pickOwnerPhone } from '@smartresidence/shared-types';
import { Button } from '@smartresidence/ui-web';
import { Phone } from 'lucide-react';

type CallOwnerButtonProps = {
  ownerContacts?: WalkInOwnerContact[];
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  className?: string;
};

export function CallOwnerButton({
  ownerContacts,
  variant = 'secondary',
  size = 'md',
  className,
}: CallOwnerButtonProps) {
  const t = useT();
  const contact = pickOwnerPhone(ownerContacts);

  if (!contact?.phone) {
    return <p className="text-xs sr-muted">{t('visitors.guard.noOwnerPhone')}</p>;
  }

  const dial = contact.phone.replace(/[\s-]/g, '');

  return (
    <Button variant={variant} size={size} className={className} asChild>
      <a href={`tel:${dial}`} title={contact.name}>
        <Phone className="size-4" />
        {t('visitors.guard.callOwner', { name: contact.name })}
      </a>
    </Button>
  );
}
