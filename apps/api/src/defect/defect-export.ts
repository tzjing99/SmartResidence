/**
 * Defect contractor exports (schedule list + handover report), rendered through
 * the shared modern PDF layout engine. Multi-page pagination, a branded header,
 * aligned metadata and per-item detail blocks — all dependency-free.
 */
import { PDF_COLORS, PdfDocument } from '../common/pdf/pdf-document';

function splitMeta(line: string): { label?: string; value: string } {
  const idx = line.indexOf(': ');
  if (idx > 0 && idx < 24) {
    return { label: line.slice(0, idx), value: line.slice(idx + 2) };
  }
  return { value: line };
}

function renderMeta(doc: PdfDocument, meta: string[]): void {
  doc.spacer(2);
  for (const raw of meta) {
    const { label, value } = splitMeta(raw);
    if (label) doc.labelValue(label, value, { labelWidth: 108 });
    else doc.paragraph(value, { size: 9.5, color: PDF_COLORS.muted });
  }
}

export interface DefectExportRow {
  reference: string;
  severity: string;
  status: string;
  title: string;
  unitLabel: string;
  category: string;
  description: string;
}

export function buildDefectListPdf(opts: {
  title: string;
  meta: string[];
  rows: DefectExportRow[];
}): Buffer {
  const doc = new PdfDocument({
    header: { brand: opts.title || 'Defect Schedule', title: 'Defect Schedule' },
    footerCaption: 'This is a computer-generated defect schedule.',
  });

  renderMeta(doc, opts.meta);
  doc.sectionTitle(`Defects (${opts.rows.length})`);

  if (opts.rows.length === 0) {
    doc.paragraph('No defects match the current filters.', { color: PDF_COLORS.muted });
    return doc.build();
  }

  opts.rows.forEach((row, idx) => {
    if (idx > 0) doc.divider();
    doc.paragraph(`${idx + 1}.  [${row.reference}]  ${row.title}`, { size: 10.5, bold: true });
    doc.paragraph(
      `Unit: ${row.unitLabel}   ·   Category: ${row.category}   ·   Severity: ${row.severity}   ·   Status: ${row.status}`,
      { size: 9, color: PDF_COLORS.muted },
    );
    if (row.description) {
      doc.spacer(2);
      doc.paragraph(row.description, { size: 9.5 });
    }
  });

  return doc.build();
}

export interface HandoverReportRow {
  reference: string;
  element: string;
  issue: string;
  status: string;
  assignee: string;
  note: string;
}

export interface HandoverReportGroup {
  space: string;
  rows: HandoverReportRow[];
}

/**
 * Contractor schedule for a handover report, grouped by space (room). Shares
 * the same modern layout engine and branded header as the defect list export.
 */
export function buildHandoverReportPdf(opts: {
  title: string;
  meta: string[];
  groups: HandoverReportGroup[];
}): Buffer {
  const doc = new PdfDocument({
    header: { brand: opts.title || 'Handover Report', title: 'Handover Defect Schedule' },
    footerCaption: 'This is a computer-generated handover schedule.',
  });

  renderMeta(doc, opts.meta);

  if (opts.groups.length === 0) {
    doc.sectionTitle('Items');
    doc.paragraph('No items in this report.', { color: PDF_COLORS.muted });
    return doc.build();
  }

  let n = 0;
  for (const group of opts.groups) {
    doc.sectionTitle(`${group.space} (${group.rows.length})`);
    group.rows.forEach((row, idx) => {
      n++;
      if (idx > 0) doc.divider();
      doc.paragraph(`${n}.  [${row.reference}]  ${row.element} — ${row.issue}`, {
        size: 10.5,
        bold: true,
      });
      doc.paragraph(`Status: ${row.status}   ·   Assignee: ${row.assignee}`, {
        size: 9,
        color: PDF_COLORS.muted,
      });
      if (row.note) {
        doc.spacer(2);
        doc.paragraph(row.note, { size: 9.5 });
      }
    });
  }

  return doc.build();
}
