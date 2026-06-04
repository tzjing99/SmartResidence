import { z } from 'zod';

export const DefectStatus = z.enum([
  'NEW',
  'ACK',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
]);
export type DefectStatus = z.infer<typeof DefectStatus>;

export const DefectSeverity = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type DefectSeverity = z.infer<typeof DefectSeverity>;

export const CreateDefectSchema = z.object({
  unitId: z.string().uuid(),
  title: z.string().min(4).max(120),
  description: z.string().min(10).max(4000),
  category: z.string(),
  severity: DefectSeverity.optional(),
  location: z.string().optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
});
export type CreateDefectInput = z.infer<typeof CreateDefectSchema>;

export const DEFECT_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Structural',
  'Lift',
  'Common area',
  'Security',
  'Cleanliness',
  'Pest control',
  'Landscape',
  'Other',
] as const;

export const KANBAN_COLUMNS: Array<{ status: DefectStatus; label: string }> = [
  { status: 'NEW', label: 'New' },
  { status: 'ASSIGNED', label: 'Assigned' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'RESOLVED', label: 'Resolved' },
  { status: 'CLOSED', label: 'Closed' },
];
