import { z } from 'zod';

/** Normalized Malaysia mobile numbers: +60 followed by 9–10 digits (leading 1). */
export const MALAYSIA_PHONE_E164_REGEX = /^\+60(1\d{8,9})$/;

/** Strip spaces/dashes and normalize common MY input to E.164 (+60…). */
export function normalizeMalaysiaPhone(input: string): string {
  const compact = input.trim().replace(/[\s-]/g, '');
  if (!compact) return '';
  if (compact.startsWith('+60')) return compact;
  if (compact.startsWith('60')) return `+${compact}`;
  if (compact.startsWith('0')) return `+6${compact}`;
  if (compact.startsWith('1')) return `+60${compact}`;
  return `+60${compact}`;
}

export function isValidMalaysiaPhone(input: string): boolean {
  return MALAYSIA_PHONE_E164_REGEX.test(normalizeMalaysiaPhone(input));
}

/** Resolve stored phone (+ optional legacy country code) to E.164 (+60…). */
export function resolveMalaysiaPhoneE164(
  phone?: string | null,
  phoneCountryCode?: string | null,
): string | null {
  if (!phone?.trim()) return null;
  const compact = phone.trim().replace(/[\s-]/g, '');
  if (compact.startsWith('+')) {
    const normalized = normalizeMalaysiaPhone(compact);
    return isValidMalaysiaPhone(normalized) ? normalized : null;
  }
  const code = (phoneCountryCode ?? '+60').replace(/\s/g, '');
  const withCode = compact.startsWith('0') || compact.startsWith('1')
    ? compact
    : `${code}${compact}`;
  const normalized = normalizeMalaysiaPhone(withCode);
  return isValidMalaysiaPhone(normalized) ? normalized : null;
}

/** Display label for guard UI — E.164 when valid, else trimmed raw input. */
export function formatMalaysiaPhoneDisplay(
  phone?: string | null,
  phoneCountryCode?: string | null,
): string | null {
  const e164 = resolveMalaysiaPhoneE164(phone, phoneCountryCode);
  if (e164) return e164;
  const trimmed = phone?.trim();
  return trimmed || null;
}

/** tel: href using full E.164; null when number is missing or invalid. */
export function malaysiaPhoneTelHref(
  phone?: string | null,
  phoneCountryCode?: string | null,
): string | null {
  const e164 = resolveMalaysiaPhoneE164(phone, phoneCountryCode);
  return e164 ? `tel:${e164}` : null;
}

export const MalaysiaPhoneSchema = z
  .string()
  .trim()
  .min(8, 'Phone number is required')
  .max(20)
  .refine(isValidMalaysiaPhone, {
    message: 'Enter a valid Malaysia mobile number (e.g. +60123456789 or 012-345 6789)',
  })
  .transform(normalizeMalaysiaPhone);

const MALAYSIA_PHONE_MESSAGE =
  'Enter a valid Malaysia mobile number (e.g. +60123456789 or 012-345 6789)';

/** Optional Malaysia mobile — empty/whitespace becomes undefined; validates +60 format when provided. */
export const OptionalMalaysiaPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .optional()
  .superRefine((value, ctx) => {
    if (!value) return;
    const normalized = normalizeMalaysiaPhone(value);
    if (!isValidMalaysiaPhone(normalized)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: MALAYSIA_PHONE_MESSAGE });
    }
  })
  .transform((value) => {
    if (!value) return undefined;
    return normalizeMalaysiaPhone(value);
  });

export const SignUpSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: MalaysiaPhoneSchema,
  password: z
    .string()
    .min(10)
    .max(200)
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/\d/, 'Add a digit'),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
