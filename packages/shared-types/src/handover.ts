import { z } from 'zod';
import { DefectSeverity, DefectStatus } from './defect';

//////////////////////////////////////////////////////////////////////////////
// Handover defect inspections: unit types, room templates & defect taxonomy.
//////////////////////////////////////////////////////////////////////////////

export const DefectReportKind = z.enum(['HANDOVER', 'STANDARD']);
export type DefectReportKind = z.infer<typeof DefectReportKind>;

/** Absolute safety ceiling — far above typical walkthroughs; server returns 400, not a crash. */
export const HANDOVER_REPORT_ITEMS_HARD_CAP = 5_000;

/** Rows per `createManyAndReturn` chunk inside one transaction. */
export const HANDOVER_REPORT_INSERT_CHUNK = 100;

/** Express JSON body limit for multi-defect POST payloads (~4 KB/item headroom). */
export const HANDOVER_REPORT_JSON_BODY_LIMIT = '20mb';

/**
 * Scale Prisma interactive-transaction limits from the number of line items so
 * small submissions stay fast and large walkthroughs get enough time to finish.
 */
export function handoverReportTxOptions(itemCount: number): { maxWait: number; timeout: number } {
  const n = Math.max(1, itemCount);
  return {
    maxWait: Math.min(30_000, 10_000 + n * 10),
    timeout: Math.min(300_000, 15_000 + n * 300),
  };
}

/** Conservative seconds to show residents while a multi-defect report saves. */
export function handoverReportEstimateSeconds(itemCount: number): number {
  const n = Math.max(1, itemCount);
  return Math.max(3, Math.ceil(2 + n * 0.2));
}

/** Friendly duration text, e.g. "about 30 seconds" / "about 2 minutes". */
export function formatHandoverSubmissionDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    const s = Math.max(1, Math.round(totalSeconds));
    return s === 1 ? 'about 1 second' : `about ${s} seconds`;
  }
  const mins = Math.ceil(totalSeconds / 60);
  return mins === 1 ? 'about 1 minute' : `about ${mins} minutes`;
}

/** Plain-language status line that updates as submission time passes. */
export function handoverSubmissionStatusMessage(
  itemCount: number,
  elapsedMs: number,
  done: boolean,
): string {
  if (done) return 'All done — taking you to your defect list.';
  const estimateMs = handoverReportEstimateSeconds(itemCount) * 1000;
  const ratio = estimateMs > 0 ? elapsedMs / estimateMs : 0;

  if (itemCount === 1) return 'Saving your defect…';
  if (itemCount <= 15) return `Saving ${itemCount} defects to your unit…`;
  if (ratio < 0.35) return `Saving ${itemCount} defects — please keep this page open.`;
  if (ratio < 0.75) return 'Still working through your list…';
  if (ratio < 1) return 'Almost finished…';
  return 'Still saving — large lists can take a little while. Please stay on this page.';
}

// -- Serialized entities ----------------------------------------------------

export interface DefectSpaceType {
  id: string;
  condoId: string;
  name: string;
  position: number;
}

export interface DefectElement {
  id: string;
  condoId: string;
  spaceTypeId: string;
  name: string;
  position: number;
}

export interface DefectIssue {
  id: string;
  condoId: string;
  elementId: string;
  name: string;
  position: number;
}

export interface DefectElementWithIssues extends DefectElement {
  issues: DefectIssue[];
}

/** A space type with its full element -> issue tree (taxonomy for one space). */
export interface DefectSpaceTypeTree extends DefectSpaceType {
  elements: DefectElementWithIssues[];
}

export interface UnitTypeSpace {
  id: string;
  unitTypeId: string;
  spaceTypeId: string | null;
  name: string;
  position: number;
  spaceType?: DefectSpaceType | null;
}

export interface UnitType {
  id: string;
  condoId: string;
  name: string;
  description: string | null;
  position: number;
  spaces?: UnitTypeSpace[];
}

// -- Handover template (resident submission UI) -----------------------------

/** A concrete room in the resident's unit, ready to attach defects to. */
export interface HandoverTemplateSpace {
  spaceLabel: string;
  spaceTypeId: string | null;
  spaceTypeName: string | null;
}

export interface HandoverTemplate {
  unitId: string;
  unitTypeId: string | null;
  unitTypeName: string | null;
  spaces: HandoverTemplateSpace[];
  /** Full per-condo taxonomy so the UI can render element/issue pickers. */
  taxonomy: DefectSpaceTypeTree[];
}

// -- Report views (management triage UI) ------------------------------------

export interface DefectReportAttachment {
  id: string;
  key: string;
  thumbnailKey: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  size: number;
}

export interface DefectReportItem {
  id: string;
  reportId: string | null;
  title: string;
  description: string;
  status: DefectStatus;
  severity: DefectSeverity;
  category: string;
  spaceLabel: string | null;
  spaceTypeId: string | null;
  spaceTypeName: string | null;
  elementId: string | null;
  elementName: string | null;
  issueId: string | null;
  issueName: string | null;
  assignedTo: { id: string; name: string } | null;
  attachments: DefectReportAttachment[];
  createdAt: string;
}

export interface DefectReportSummary {
  id: string;
  condoId: string;
  unitId: string | null;
  kind: DefectReportKind;
  title: string;
  createdAt: string;
  raisedBy: { id: string; name: string } | null;
  unit: {
    id: string;
    identifier: string;
    floor?: number | null;
    block: { name: string } | null;
  } | null;
  itemCount: number;
  statusCounts: Partial<Record<DefectStatus, number>>;
}

export interface DefectReportDetail extends DefectReportSummary {
  items: DefectReportItem[];
}

// -- Config CRUD input schemas ----------------------------------------------

export const CreateUnitTypeSchema = z.object({
  condoId: z.string().uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  position: z.number().int().min(0).optional(),
});
export type CreateUnitTypeInput = z.infer<typeof CreateUnitTypeSchema>;

export const UpdateUnitTypeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateUnitTypeInput = z.infer<typeof UpdateUnitTypeSchema>;

export const CreateUnitTypeSpaceSchema = z.object({
  name: z.string().min(1).max(80),
  spaceTypeId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
});
export type CreateUnitTypeSpaceInput = z.infer<typeof CreateUnitTypeSpaceSchema>;

export const UpdateUnitTypeSpaceSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  spaceTypeId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateUnitTypeSpaceInput = z.infer<typeof UpdateUnitTypeSpaceSchema>;

export const CreateDefectSpaceTypeSchema = z.object({
  condoId: z.string().uuid(),
  name: z.string().min(1).max(80),
  position: z.number().int().min(0).optional(),
});
export type CreateDefectSpaceTypeInput = z.infer<typeof CreateDefectSpaceTypeSchema>;

export const UpdateDefectSpaceTypeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateDefectSpaceTypeInput = z.infer<typeof UpdateDefectSpaceTypeSchema>;

export const CreateDefectElementSchema = z.object({
  spaceTypeId: z.string().uuid(),
  name: z.string().min(1).max(80),
  position: z.number().int().min(0).optional(),
});
export type CreateDefectElementInput = z.infer<typeof CreateDefectElementSchema>;

export const UpdateDefectElementSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateDefectElementInput = z.infer<typeof UpdateDefectElementSchema>;

export const CreateDefectIssueSchema = z.object({
  elementId: z.string().uuid(),
  name: z.string().min(1).max(120),
  position: z.number().int().min(0).optional(),
});
export type CreateDefectIssueInput = z.infer<typeof CreateDefectIssueSchema>;

export const UpdateDefectIssueSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateDefectIssueInput = z.infer<typeof UpdateDefectIssueSchema>;

/** Assign (or clear with null) a unit's unit type. */
export const SetUnitTypeSchema = z.object({
  unitTypeId: z.string().uuid().nullable(),
});
export type SetUnitTypeInput = z.infer<typeof SetUnitTypeSchema>;

// -- Handover report create -------------------------------------------------

export const HandoverReportItemSchema = z.object({
  /** Room label within the unit, e.g. "Bathroom 1". */
  spaceLabel: z.string().min(1).max(120),
  spaceTypeId: z.string().uuid().optional(),
  elementId: z.string().uuid().optional(),
  issueId: z.string().uuid().optional(),
  /** Optional free-text element/issue when not picked from the taxonomy. */
  elementName: z.string().min(1).max(120).optional(),
  issueName: z.string().min(1).max(160).optional(),
  note: z.string().max(2000).optional(),
  attachmentIds: z.array(z.string().uuid()).max(10).optional(),
});
export type HandoverReportItemInput = z.infer<typeof HandoverReportItemSchema>;

export const CreateHandoverReportSchema = z.object({
  unitId: z.string().uuid(),
  title: z.string().min(3).max(160).optional(),
  items: z.array(HandoverReportItemSchema).min(1).max(HANDOVER_REPORT_ITEMS_HARD_CAP),
});
export type CreateHandoverReportInput = z.infer<typeof CreateHandoverReportSchema>;

// -- Bulk triage ------------------------------------------------------------

export const BulkUpdateReportItemsSchema = z
  .object({
    defectIds: z.array(z.string().uuid()).min(1).max(HANDOVER_REPORT_ITEMS_HARD_CAP),
    status: DefectStatus.optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    message: z.string().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.assignedToUserId !== undefined, {
    message: 'Provide a status and/or an assignee to apply',
  });
export type BulkUpdateReportItemsInput = z.infer<typeof BulkUpdateReportItemsSchema>;

/**
 * Auto-derive a handover defect's title from its taxonomy selection so the
 * existing Defect lifecycle/board/export keep working unchanged.
 */
export function handoverDefectTitle(parts: {
  spaceLabel: string;
  elementName?: string | null;
  issueName?: string | null;
}): string {
  const head = parts.elementName ? `${parts.spaceLabel} - ${parts.elementName}` : parts.spaceLabel;
  return parts.issueName ? `${head}: ${parts.issueName}` : head;
}
