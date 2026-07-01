/** Helpdesk thread transcript PDF, via the shared modern layout engine. */
import { PDF_COLORS, PdfDocument } from '../common/pdf/pdf-document';

function splitMeta(line: string): { label?: string; value: string } {
  const idx = line.indexOf(': ');
  if (idx > 0 && idx < 24) {
    return { label: line.slice(0, idx), value: line.slice(idx + 2) };
  }
  return { value: line };
}

export function buildThreadPdf(opts: {
  title: string;
  meta: string[];
  messages: Array<{ author: string; at: string; body: string; kind?: string }>;
}): Buffer {
  const doc = new PdfDocument({
    header: {
      brand: opts.title || 'Helpdesk Thread',
      title: 'Helpdesk Thread Transcript',
    },
    footerCaption: 'This is a computer-generated transcript.',
  });

  // Thread metadata as aligned label/value rows.
  doc.spacer(2);
  for (const raw of opts.meta) {
    const { label, value } = splitMeta(raw);
    if (label) doc.labelValue(label, value, { labelWidth: 96 });
    else doc.paragraph(value, { size: 9.5, color: PDF_COLORS.muted });
  }

  doc.sectionTitle(`Messages (${opts.messages.length})`);

  if (opts.messages.length === 0) {
    doc.paragraph('No messages to display.', { color: PDF_COLORS.muted });
  }

  opts.messages.forEach((m, i) => {
    if (i > 0) doc.spacer(6);
    const kind = m.kind && m.kind !== 'MESSAGE' ? `  ·  ${m.kind}` : '';
    doc.paragraph(`${m.author}${kind}`, { size: 10, bold: true });
    doc.paragraph(m.at, { size: 8, color: PDF_COLORS.muted });
    doc.spacer(2);
    doc.paragraph(m.body || '(no content)', { size: 10 });
  });

  return doc.build();
}
