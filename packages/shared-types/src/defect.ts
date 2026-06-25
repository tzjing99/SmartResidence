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

export const TransitionDefectSchema = z.object({
  status: DefectStatus,
  message: z.string().max(4000).optional(),
  assignedToUserId: z.string().uuid().optional(),
});
export type TransitionDefectInput = z.infer<typeof TransitionDefectSchema>;

export const AddDefectUpdateSchema = z.object({
  message: z.string().min(1).max(4000),
  isInternal: z.boolean().optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
});
export type AddDefectUpdateInput = z.infer<typeof AddDefectUpdateSchema>;

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

export const DEFECT_STATUS_LABELS: Record<DefectStatus, string> = {
  NEW: 'Submitted',
  ACK: 'Acknowledged',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};

export const DEFECT_SEVERITY_LABELS: Record<DefectSeverity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

/**
 * The "happy path" lifecycle milestones, in order. Used to render a progress
 * timeline; REOPENED is an off-path branch and is surfaced via the activity
 * feed rather than as its own milestone.
 */
export const DEFECT_STATUS_FLOW: DefectStatus[] = [
  'NEW',
  'ACK',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

/** Allowed forward/backward transitions, mirrored by the API guard. */
export const DEFECT_TRANSITIONS: Record<DefectStatus, DefectStatus[]> = {
  NEW: ['ACK', 'ASSIGNED', 'RESOLVED', 'CLOSED'],
  ACK: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
};

export function nextDefectStatuses(status: DefectStatus): DefectStatus[] {
  return DEFECT_TRANSITIONS[status] ?? [];
}

/** True when a status represents a finished lifecycle (no longer actionable). */
export function isTerminalDefectStatus(status: DefectStatus): boolean {
  return status === 'CLOSED';
}

/**
 * Human-readable short reference for a defect, derived deterministically from
 * its id (e.g. `DF-1A2B3C4D`). Used in the contractor export and anywhere a
 * compact ticket label is friendlier than a raw UUID.
 */
export function defectReference(id: string): string {
  return `DF-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
