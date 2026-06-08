'use client';

import { api } from '@/lib/api';
import {
  type UnitSearchItem,
  formatUnitLabel,
  normalizeUnitSearchTerm,
} from '@smartresidence/shared-types';
import { Input, Label, cn } from '@smartresidence/ui-web';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

export type { UnitSearchItem };
export { formatUnitLabel };

type UnitSearchPickerProps = {
  condoId: string | null | undefined;
  value: UnitSearchItem | null;
  onChange: (unit: UnitSearchItem | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function UnitSearchPicker({
  condoId,
  value,
  onChange,
  label = 'Unit',
  placeholder = 'Search block, unit number, or resident name…',
  disabled,
  className,
}: UnitSearchPickerProps) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (value) setQuery(formatUnitLabel(value));
  }, [value]);

  const search = useQuery({
    queryKey: ['units', 'search', condoId, query],
    queryFn: () =>
      condoId
        ? api.listUnits(condoId, {
            search: normalizeUnitSearchTerm(query) || undefined,
            limit: 20,
          })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(condoId) && open && query.trim().length >= 1,
  });

  const items = (search.data?.items ?? []) as UnitSearchItem[];

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={rootRef} className={cn('relative flex flex-col gap-1.5', className)}>
      <Label>{label}</Label>
      <Input
        value={query}
        disabled={disabled || !condoId}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(null);
          setOpen(true);
        }}
        autoComplete="off"
      />
      {open && query.trim() && condoId ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))] shadow-lg">
          {search.isLoading ? (
            <p className="px-3 py-2 text-sm sr-muted">Searching…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-2 text-sm sr-muted">No units found</p>
          ) : (
            items.map((unit) => (
              <button
                key={unit.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[rgb(var(--sr-border))]/30"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(unit);
                  setQuery(formatUnitLabel(unit));
                  setOpen(false);
                }}
              >
                {formatUnitLabel(unit)}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
