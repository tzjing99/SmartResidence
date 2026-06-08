/** Unit row shape returned by tenant unit search APIs. */
export type UnitSearchItem = {
  id: string;
  identifier: string;
  block?: { name?: string | null } | null;
  ownerships?: Array<{ user?: { name?: string | null } | null }>;
};

/** Parse "Block-Floor-Unit" style labels (e.g. "A-01-1" → block A, rest 01-1). */
export function parseCompositeUnitLabel(
  term: string,
): { block: string; rest: string } | null {
  const match = term.match(/^([A-Za-z0-9]+)[-·\s]+(.+)$/);
  if (!match) return null;
  const block = match[1]?.trim();
  const rest = match[2]?.trim();
  if (!block || !rest) return null;
  return { block, rest };
}

function identifierIncludesBlock(block: string, identifier: string): boolean {
  const trimmed = identifier.trim();
  const composite = parseCompositeUnitLabel(trimmed);
  if (composite && composite.block.toLowerCase() === block.toLowerCase()) {
    return true;
  }
  const escaped = block.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}[-·\\s]`, 'i').test(trimmed);
}

/** Guard-friendly display label: unit first, owner second; no redundant block prefix. */
export function formatUnitLabel(unit: UnitSearchItem): string {
  const block = unit.block?.name?.trim();
  const identifier = unit.identifier.trim();
  const owners = (unit.ownerships ?? [])
    .map((o) => o.user?.name?.trim())
    .filter(Boolean)
    .join(', ');

  let base: string;
  if (!block || identifierIncludesBlock(block, identifier)) {
    base = identifier;
  } else {
    base = `Block ${block} · Unit ${identifier}`;
  }

  return owners ? `${base} — ${owners}` : base;
}

/** Normalize picker/display input before querying (e.g. "A-01-1 — Owner" → "A-01-1"). */
export function normalizeUnitSearchTerm(raw: string): string {
  const term = raw.trim();
  if (!term) return term;

  const withoutOwner = term.split('—')[0]?.trim() ?? term;

  const blockUnitMatch = withoutOwner.match(/^Block\s+[^·]+·\s*Unit\s+(.+)$/i);
  if (blockUnitMatch?.[1]) {
    return blockUnitMatch[1].trim();
  }

  const labelMatch = withoutOwner.match(/^[^·]+·\s*(.+)$/);
  if (labelMatch?.[1]) {
    return labelMatch[1].trim();
  }

  return withoutOwner;
}
