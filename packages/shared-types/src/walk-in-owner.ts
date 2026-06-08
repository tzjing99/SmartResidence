import { z } from 'zod';

export const WalkInOwnerContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  isPrimary: z.boolean(),
});
export type WalkInOwnerContact = z.infer<typeof WalkInOwnerContactSchema>;

/** Primary owner phone, else first owner with a phone on file. */
export function pickOwnerPhone(
  contacts: WalkInOwnerContact[] | undefined,
): WalkInOwnerContact | null {
  if (!contacts?.length) return null;
  const withPhone = contacts.filter((c) => c.phone?.trim());
  if (!withPhone.length) return null;
  return withPhone.find((c) => c.isPrimary) ?? withPhone[0] ?? null;
}
