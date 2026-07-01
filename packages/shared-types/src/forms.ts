import { z } from 'zod';

export const FormTemplateKind = z.enum([
  'MOVE_IN',
  'MOVE_OUT',
  'RENOVATION',
  'VEHICLE_STICKER',
  'CUSTOM',
]);
export type FormTemplateKind = z.infer<typeof FormTemplateKind>;

export const FORM_TEMPLATE_KIND_LABELS: Record<FormTemplateKind, string> = {
  MOVE_IN: 'Move-in application',
  MOVE_OUT: 'Move-out application',
  RENOVATION: 'Renovation permit',
  VEHICLE_STICKER: 'Vehicle sticker',
  CUSTOM: 'Custom form',
};

export const FormSubmissionStatus = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);
export type FormSubmissionStatus = z.infer<typeof FormSubmissionStatus>;

export const FORM_SUBMISSION_STATUS_LABELS: Record<FormSubmissionStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const FormFieldType = z.enum(['text', 'textarea', 'date', 'boolean', 'select']);
export type FormFieldType = z.infer<typeof FormFieldType>;

export const FormFieldDefinitionSchema = z.object({
  id: z.string().min(1).max(64),
  type: FormFieldType,
  label: z.string().min(1).max(200),
  required: z.boolean().optional(),
  placeholder: z.string().max(500).optional(),
  options: z.array(z.string().min(1).max(120)).optional(),
});
export type FormFieldDefinition = z.infer<typeof FormFieldDefinitionSchema>;

export const FormFieldsSchema = z.object({
  fields: z.array(FormFieldDefinitionSchema),
});
export type FormFields = z.infer<typeof FormFieldsSchema>;

export const FormTemplateSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  kind: FormTemplateKind,
  title: z.string(),
  fields: FormFieldsSchema,
  active: z.boolean(),
  position: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type FormTemplate = z.infer<typeof FormTemplateSchema>;

export const FormSubmissionSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  condoId: z.string().uuid(),
  unitId: z.string().uuid(),
  userId: z.string().uuid(),
  status: FormSubmissionStatus,
  answers: z.record(z.unknown()),
  reviewedByUserId: z.string().uuid().nullable().optional(),
  reviewedAt: z.coerce.date().nullable().optional(),
  reviewNote: z.string().nullable().optional(),
  submittedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  template: FormTemplateSchema.partial().optional(),
  unit: z.object({ id: z.string().uuid(), identifier: z.string() }).nullable().optional(),
  user: z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional(),
  reviewedBy: z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional(),
});
export type FormSubmission = z.infer<typeof FormSubmissionSchema>;

export const CreateFormTemplateInputSchema = z.object({
  condoId: z.string().uuid(),
  kind: FormTemplateKind,
  title: z.string().min(2).max(200),
  fields: FormFieldsSchema,
  active: z.boolean().optional(),
  position: z.number().int().optional(),
});
export type CreateFormTemplateInput = z.infer<typeof CreateFormTemplateInputSchema>;

export const UpdateFormTemplateInputSchema = CreateFormTemplateInputSchema.partial().omit({
  condoId: true,
});
export type UpdateFormTemplateInput = z.infer<typeof UpdateFormTemplateInputSchema>;

export const CreateFormSubmissionInputSchema = z.object({
  templateId: z.string().uuid(),
  unitId: z.string().uuid(),
  answers: z.record(z.unknown()).default({}),
  submit: z.boolean().optional(),
});
export type CreateFormSubmissionInput = z.infer<typeof CreateFormSubmissionInputSchema>;

export const UpdateFormSubmissionInputSchema = z.object({
  answers: z.record(z.unknown()).optional(),
  submit: z.boolean().optional(),
});
export type UpdateFormSubmissionInput = z.infer<typeof UpdateFormSubmissionInputSchema>;

export const RejectFormSubmissionInputSchema = z.object({
  reviewNote: z.string().max(2000).optional(),
});
export type RejectFormSubmissionInput = z.infer<typeof RejectFormSubmissionInputSchema>;

/** Default MY condo form field sets seeded on first use per condo. */
export const DEFAULT_FORM_TEMPLATES: Array<{
  kind: FormTemplateKind;
  title: string;
  fields: FormFields;
}> = [
  {
    kind: 'MOVE_IN',
    title: 'Move-in application',
    fields: {
      fields: [
        { id: 'moveDate', type: 'date', label: 'Move date', required: true },
        {
          id: 'occupantNames',
          type: 'textarea',
          label: 'Occupant names',
          required: true,
          placeholder: 'Full names of all occupants moving in',
        },
        {
          id: 'contractorContact',
          type: 'text',
          label: 'Contractor contact',
          placeholder: 'Name and phone number',
        },
        {
          id: 'vehiclePlates',
          type: 'text',
          label: 'Vehicle plate numbers',
          placeholder: 'e.g. WXY 1234, VAB 5678',
        },
      ],
    },
  },
  {
    kind: 'MOVE_OUT',
    title: 'Move-out application',
    fields: {
      fields: [
        { id: 'moveDate', type: 'date', label: 'Move date', required: true },
        {
          id: 'forwardingAddress',
          type: 'textarea',
          label: 'Forwarding address',
          required: true,
          placeholder: 'Where correspondence should be sent',
        },
        {
          id: 'keysReturned',
          type: 'boolean',
          label: 'I confirm all keys and access cards have been returned',
          required: true,
        },
      ],
    },
  },
  {
    kind: 'RENOVATION',
    title: 'Renovation permit',
    fields: {
      fields: [
        {
          id: 'workScope',
          type: 'textarea',
          label: 'Scope of renovation work',
          required: true,
        },
        {
          id: 'contractorCompany',
          type: 'text',
          label: 'Contractor company',
          required: true,
        },
        { id: 'startDate', type: 'date', label: 'Work start date', required: true },
        { id: 'endDate', type: 'date', label: 'Expected completion date', required: true },
        {
          id: 'depositAcknowledgement',
          type: 'boolean',
          label: 'I acknowledge the renovation deposit requirements',
          required: true,
        },
      ],
    },
  },
  {
    kind: 'VEHICLE_STICKER',
    title: 'Vehicle sticker application',
    fields: {
      fields: [
        {
          id: 'plateNumber',
          type: 'text',
          label: 'Vehicle plate number',
          required: true,
          placeholder: 'e.g. WXY 1234',
        },
        {
          id: 'vehicleType',
          type: 'select',
          label: 'Vehicle type',
          required: true,
          options: ['Car', 'Motorcycle', 'Other'],
        },
        {
          id: 'bayNumber',
          type: 'text',
          label: 'Parking bay (if assigned)',
          placeholder: 'e.g. B2-045',
        },
      ],
    },
  },
];
