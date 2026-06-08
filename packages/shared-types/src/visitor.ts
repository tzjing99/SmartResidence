import { z } from 'zod';
import { MalaysiaPhoneSchema, OptionalMalaysiaPhoneSchema } from './phone';
import { WalkInOwnerContactSchema } from './walk-in-owner';

export const VisitorVisitType = z.enum(['PRE_REG', 'WALKIN_UNIT', 'WALKIN_OFFICE']);
export type VisitorVisitType = z.infer<typeof VisitorVisitType>;

export const VisitorEntryMode = z.enum(['WALK_IN', 'DRIVE_IN']);
export type VisitorEntryMode = z.infer<typeof VisitorEntryMode>;

export const VisitorPurpose = z.enum([
  'VISITOR',
  'CONTRACTOR',
  'GOVERNMENT_UTILITIES',
  'DELIVERY',
  'MAINTENANCE',
  'OTHER',
]);
export type VisitorPurpose = z.infer<typeof VisitorPurpose>;

export const VISITOR_PURPOSE_OPTIONS: { value: VisitorPurpose; label: string }[] = [
  { value: 'VISITOR', label: 'Visitor' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'GOVERNMENT_UTILITIES', label: 'Government / utilities' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OTHER', label: 'Other' },
];

export const PHONE_COUNTRY_CODES = ['+60', '+65', '+86', '+1', '+44', '+61'] as const;

export const VisitorStatus = z.enum([
  'PENDING_OWNER_APPROVAL',
  'PENDING_MANAGEMENT_APPROVAL',
  'APPROVED',
  'REJECTED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'EXPIRED',
  'CANCELLED',
]);
export type VisitorStatus = z.infer<typeof VisitorStatus>;

/** Next hour from now for smart default arrival. */
export function defaultExpectedArrival(now = new Date()): Date {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  if (d.getTime() <= now.getTime()) {
    d.setHours(d.getHours() + 1);
  }
  return d;
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Malaysian states/territories for state-specific public holiday resolution (date-holidays codes). */
export const MY_STATE_OPTIONS = [
  { value: '', label: 'Federal only (nationwide)' },
  { value: '01', label: 'Johor' },
  { value: '02', label: 'Kedah' },
  { value: '03', label: 'Kelantan' },
  { value: '04', label: 'Malacca (Melaka)' },
  { value: '05', label: 'Negeri Sembilan' },
  { value: '06', label: 'Pahang' },
  { value: '07', label: 'Penang (Pulau Pinang)' },
  { value: '08', label: 'Perak' },
  { value: '09', label: 'Perlis' },
  { value: '10', label: 'Selangor' },
  { value: '11', label: 'Terengganu' },
  { value: '12', label: 'Sabah' },
  { value: '13', label: 'Sarawak' },
  { value: '14', label: 'Kuala Lumpur' },
  { value: '15', label: 'Labuan' },
  { value: '16', label: 'Putrajaya' },
] as const;

export const ResolvedHolidaySchema = z.object({
  date: z.string(),
  name: z.string(),
});
export type ResolvedHoliday = z.infer<typeof ResolvedHolidaySchema>;

export const CondoVisitorSettingsSchema = z.object({
  maxOvernightVisitsPerUnitPerMonth: z.number().int().min(1).default(4),
  overnightSlotsPerNight: z.number().int().min(1).default(10),
  walkInApprovalMinutes: z.number().int().min(1).default(15),
  /** When true, unit walk-ins wait for owner/tenant approval before check-in. */
  walkInRequireOwnerApproval: z.boolean().default(true),
  preRegExpiryBufferMins: z.number().int().min(0).default(120),
  urgentOvernightMinHours: z.number().int().min(1).default(24),
  workingDays: z.object({ weekdays: z.array(z.number().int().min(1).max(7)) }),
  holidayAuto: z.boolean().default(true),
  holidayState: z.string().default(''),
  customHolidays: z.array(z.string()).default([]),
  holidayExclusions: z.array(z.string()).default([]),
  publicHolidays: z.array(z.string()),
  resolvedHolidays: z.array(ResolvedHolidaySchema).default([]),
  holidayOvernightAutoApprove: z.boolean().default(true),
  countPendingTowardCap: z.boolean().default(true),
  requirePlatePhotoOvernight: z.boolean().default(true),
  defaultPurpose: VisitorPurpose.default('VISITOR'),
});
export type CondoVisitorSettings = z.infer<typeof CondoVisitorSettingsSchema>;

export const UpdateCondoVisitorSettingsSchema = CondoVisitorSettingsSchema.partial();
export type UpdateCondoVisitorSettingsInput = z.infer<typeof UpdateCondoVisitorSettingsSchema>;

export const OvernightUnitSummarySchema = z.object({
  unitId: z.string().uuid(),
  unitIdentifier: z.string(),
  owners: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().nullable().optional(),
      isPrimary: z.boolean(),
    }),
  ),
  overnightCountThisMonth: z.number().int(),
  monthlyLimit: z.number().int(),
  status: z.enum(['active', 'suspended']),
  overnightSuspendedUntil: z.coerce.date().nullable(),
  suspendedIndefinite: z.boolean().optional(),
  suspendReason: z.string().nullable(),
});
export type OvernightUnitSummary = z.infer<typeof OvernightUnitSummarySchema>;

export const CreateVisitorSchema = z
  .object({
    unitId: z.string().uuid(),
    name: z.string().min(2).max(120),
    identification: z.string().max(60).optional(),
    phoneCountryCode: z.string().max(6).default('+60'),
    phone: MalaysiaPhoneSchema,
    entryMode: VisitorEntryMode.optional().default('DRIVE_IN'),
    vehiclePlate: z.string().max(20).optional(),
    vehiclePlatePhotoUrl: z.string().max(500).optional(),
    purpose: VisitorPurpose.default('VISITOR'),
    expectedAt: z.coerce.date(),
    expectedDurationMins: z.number().int().min(1).optional(),
    overnight: z.boolean().default(false),
    urgentReason: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.entryMode === 'DRIVE_IN' && !data.vehiclePlate?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Plate number is required for drive-in visitors',
        path: ['vehiclePlate'],
      });
    }
    if (data.overnight) {
      if (!data.vehiclePlate?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Typed plate number is required for overnight — must match your photo',
          path: ['vehiclePlate'],
        });
      }
      const hours = (data.expectedAt.getTime() - Date.now()) / (60 * 60 * 1000);
      if (hours < 24 && !data.urgentReason?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please briefly explain why this is an urgent overnight visit',
          path: ['urgentReason'],
        });
      }
    }
  });
export type CreateVisitorInput = z.infer<typeof CreateVisitorSchema>;

export const OvernightPreviewSchema = z.object({
  overnight: z.literal(true),
  hoursUntilArrival: z.number(),
  isUrgent: z.boolean(),
  isHolidayAuto: z.boolean(),
  isWorkingDayArrival: z.boolean(),
  maxSlots: z.number(),
  occupiedSlots: z.number(),
  remainingSlots: z.number(),
  slotsFull: z.boolean(),
  nextReviewDate: z.string(),
  helperMessage: z.string(),
});
export type OvernightPreview = z.infer<typeof OvernightPreviewSchema>;

export const CreateWalkInUnitSchema = z.object({
  unitId: z.string().uuid(),
  name: z.string().min(2).max(120),
  phone: OptionalMalaysiaPhoneSchema,
  vehiclePlate: z.string().max(20).optional(),
  purpose: z.string().max(200).optional(),
});
export type CreateWalkInUnitInput = z.infer<typeof CreateWalkInUnitSchema>;

export const CreateWalkInOfficeSchema = z.object({
  name: z.string().min(2).max(120),
  phone: OptionalMalaysiaPhoneSchema,
  vehiclePlate: z.string().max(20).optional(),
  purpose: z.string().min(3).max(200),
  gateLocation: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});
export type CreateWalkInOfficeInput = z.infer<typeof CreateWalkInOfficeSchema>;

export const VisitorSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  visitType: VisitorVisitType,
  unitId: z.string().uuid().nullable().optional(),
  hostUserId: z.string().uuid().nullable().optional(),
  name: z.string(),
  identification: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  phoneCountryCode: z.string().nullable().optional(),
  entryMode: VisitorEntryMode.optional(),
  vehiclePlate: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  overnight: z.boolean().optional(),
  urgentOvernight: z.boolean().optional(),
  urgentReason: z.string().nullable().optional(),
  pendingManagementReview: z.boolean().optional(),
  expectedAt: z.coerce.date(),
  expectedDurationMins: z.number().nullable().optional(),
  qrCode: z.string().nullable().optional(),
  qrPayload: z.string().nullable().optional(),
  accessCode: z.string().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  approvalDeadline: z.coerce.date().nullable().optional(),
  status: VisitorStatus,
  approvedAt: z.coerce.date().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  /** Guard-only: unit owner contacts while awaiting owner approval. */
  ownerContacts: z.array(WalkInOwnerContactSchema).optional(),
});
export type Visitor = z.infer<typeof VisitorSchema>;

export const VisitorListView = z.enum(['upcoming', 'live', 'history']);
export type VisitorListView = z.infer<typeof VisitorListView>;

export type VisitorAdminFilter = 'overnight_pending' | 'urgent_overnight' | 'holiday_review';

/** Privacy-scoped DTO for guard live board — gate duty fields only. */
export const GuardLiveVisitorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  checkedInAt: z.coerce.date(),
  unitLabel: z.string().nullable(),
  visitType: VisitorVisitType,
  overnight: z.boolean().optional(),
  /** Unit owners — name + phone only, for tel: links during gate duty. */
  ownerContacts: z.array(WalkInOwnerContactSchema).optional(),
});
export type GuardLiveVisitor = z.infer<typeof GuardLiveVisitorSchema>;

export const GuardLiveVisitorsResponseSchema = z.object({
  items: z.array(GuardLiveVisitorSchema),
  total: z.number().int(),
});
export type GuardLiveVisitorsResponse = z.infer<typeof GuardLiveVisitorsResponseSchema>;

export const FavouriteVisitorSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  unitId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  phoneCountryCode: z.string().nullable().optional(),
  entryMode: VisitorEntryMode.optional(),
  vehiclePlate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type FavouriteVisitor = z.infer<typeof FavouriteVisitorSchema>;

export const CreateFavouriteVisitorSchema = z.object({
  unitId: z.string().uuid(),
  name: z.string().min(2).max(120),
  phone: MalaysiaPhoneSchema,
  phoneCountryCode: z.string().max(6).default('+60'),
  entryMode: VisitorEntryMode.default('DRIVE_IN'),
  vehiclePlate: z.string().max(20).optional(),
  notes: z.string().max(200).optional(),
});
export type CreateFavouriteVisitorInput = z.infer<typeof CreateFavouriteVisitorSchema>;

export const UpdateFavouriteVisitorSchema = CreateFavouriteVisitorSchema.omit({
  unitId: true,
}).partial();
export type UpdateFavouriteVisitorInput = z.infer<typeof UpdateFavouriteVisitorSchema>;

export type VisitorPassShareInput = {
  visitorName: string;
  accessCode: string;
  expectedAt: Date;
  expiresAt?: Date | null;
  unitIdentifier?: string | null;
};

/** Plain-language share title for visitor passes (WhatsApp, iMessage, system share). */
export function formatVisitorPassShareTitle(visitorName: string): string {
  return `Visitor pass — ${visitorName}`;
}

/** Plain-language share body with access code, validity window, and unit. */
export function formatVisitorPassShareText(input: VisitorPassShareInput): string {
  const validWindow = formatVisitorPassValidityWindow(input.expectedAt, input.expiresAt);
  const lines = [
    `Hi! Here's your visitor pass for ${input.visitorName}.`,
    '',
    `Access code: ${input.accessCode}`,
    `Valid: ${validWindow}`,
  ];
  if (input.unitIdentifier?.trim()) {
    lines.push(`Unit: ${input.unitIdentifier.trim()}`);
  }
  lines.push('', 'Show this code or the QR at the guardhouse when you arrive.');
  return lines.join('\n');
}

function formatVisitorPassValidityWindow(expectedAt: Date, expiresAt?: Date | null): string {
  const start = expectedAt.toLocaleString();
  if (expiresAt) {
    return `${start} – ${expiresAt.toLocaleString()}`;
  }
  return `from ${start}`;
}

/** Build pre-reg query params from a favourite for /visitors/new pre-fill. */
export function favouriteToPreRegParams(fav: FavouriteVisitor): Record<string, string> {
  const params: Record<string, string> = { name: fav.name };
  if (fav.phone?.trim()) params.phone = fav.phone.trim();
  if (fav.phoneCountryCode) params.phoneCountryCode = fav.phoneCountryCode;
  if (fav.vehiclePlate) params.vehiclePlate = fav.vehiclePlate;
  if (fav.entryMode) params.entryMode = fav.entryMode;
  return params;
}

function resolvePurposeForPreReg(purpose: string | null | undefined): VisitorPurpose {
  const parsed = VisitorPurpose.safeParse(purpose);
  return parsed.success ? parsed.data : 'VISITOR';
}

/** Build pre-reg query params from a past visit for /visitors/new pre-fill or one-click re-register. */
export function visitorToPreRegParams(visitor: Visitor): Record<string, string> {
  const params: Record<string, string> = { name: visitor.name };
  if (visitor.phone?.trim()) params.phone = visitor.phone.trim();
  if (visitor.phoneCountryCode) params.phoneCountryCode = visitor.phoneCountryCode;
  if (visitor.vehiclePlate?.trim()) params.vehiclePlate = visitor.vehiclePlate.trim();
  const entryMode = visitor.vehiclePlate?.trim() ? 'DRIVE_IN' : 'WALK_IN';
  params.entryMode = entryMode;
  params.purpose = resolvePurposeForPreReg(visitor.purpose);
  params.expectedAt = defaultExpectedArrival().toISOString();
  return params;
}

/** Whether a past visit has enough data for one-click pre-registration. */
export function canOneClickPreRegFromVisitor(visitor: Visitor): boolean {
  if (!visitor.phone?.trim()) return false;
  const entryMode = visitor.vehiclePlate?.trim() ? 'DRIVE_IN' : 'WALK_IN';
  if (entryMode === 'DRIVE_IN' && !visitor.vehiclePlate?.trim()) return false;
  return true;
}
