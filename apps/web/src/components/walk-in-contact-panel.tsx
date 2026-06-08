'use client';

import { useT } from '@/i18n/locale-provider';
import {
  type WalkInOwnerContact,
  formatMalaysiaPhoneDisplay,
  malaysiaPhoneTelHref,
} from '@smartresidence/shared-types';
import { Phone } from 'lucide-react';

type WalkInContactPanelProps = {
  visitorPhone?: string | null;
  visitorPhoneCountryCode?: string | null;
  ownerContacts?: WalkInOwnerContact[];
  compact?: boolean;
};

export function WalkInContactPanel({
  visitorPhone,
  visitorPhoneCountryCode,
  ownerContacts,
  compact = false,
}: WalkInContactPanelProps) {
  const t = useT();
  const visitorDisplay = formatMalaysiaPhoneDisplay(visitorPhone, visitorPhoneCountryCode);
  const visitorHref = malaysiaPhoneTelHref(visitorPhone, visitorPhoneCountryCode);
  const ownersWithPhone = ownerContacts?.filter((contact) => contact.phone?.trim()) ?? [];

  const linkClass = compact
    ? 'inline-flex items-center gap-1 text-coral-600 hover:underline text-sm font-medium'
    : 'inline-flex items-center gap-1.5 text-coral-600 hover:underline text-sm font-medium';

  return (
    <div
      className={
        compact
          ? 'flex flex-col gap-1.5 text-sm'
          : 'flex flex-col gap-2 rounded-lg border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-surface))] p-3'
      }
    >
      {!compact ? (
        <p className="text-xs font-semibold uppercase tracking-wide sr-muted">
          {t('visitors.guard.contactSection')}
        </p>
      ) : null}

      <div className={compact ? 'flex flex-col gap-0.5' : 'flex flex-col gap-1'}>
        <span className="text-xs sr-muted">{t('visitors.guard.visitorPhone')}</span>
        {visitorDisplay && visitorHref ? (
          <a href={visitorHref} className={linkClass}>
            <Phone className="size-3.5 shrink-0" />
            {visitorDisplay}
            <span className="sr-only">{t('visitors.guard.callVisitor')}</span>
          </a>
        ) : (
          <span className="text-sm sr-muted">{t('visitors.guard.phoneNotProvided')}</span>
        )}
      </div>

      <div className={compact ? 'flex flex-col gap-0.5' : 'flex flex-col gap-1'}>
        <span className="text-xs sr-muted">{t('visitors.guard.ownerPhones')}</span>
        {ownersWithPhone.length > 0 ? (
          <ul className={compact ? 'flex flex-col gap-1' : 'flex flex-col gap-1.5'}>
            {ownersWithPhone.map((owner) => {
              const ownerDisplay = formatMalaysiaPhoneDisplay(owner.phone) ?? owner.phone;
              const ownerHref = malaysiaPhoneTelHref(owner.phone);
              if (!ownerHref) return null;
              return (
                <li key={owner.id}>
                  <a href={ownerHref} className={linkClass} title={owner.name}>
                    <Phone className="size-3.5 shrink-0" />
                    {owner.name}
                    <span className="sr-muted font-normal"> · {ownerDisplay}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <span className="text-sm sr-muted">{t('visitors.guard.noOwnerPhone')}</span>
        )}
      </div>
    </div>
  );
}
