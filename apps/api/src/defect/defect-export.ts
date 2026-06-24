/**
 * Dependency-free, multi-page PDF builder for the defect contractor export.
 *
 * Mirrors the approach used by the thread transcript export but adds pagination
 * so a long defect schedule isn't truncated to a single page. No external PDF
 * library is pulled in — we emit a minimal but valid PDF 1.4 document.
 */
function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLines(text: string, maxLen = 98): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let rest = paragraph;
    while (rest.length > maxLen) {
      let breakAt = rest.lastIndexOf(' ', maxLen);
      if (breakAt < maxLen * 0.5) breakAt = maxLen;
      lines.push(rest.slice(0, breakAt).trim());
      rest = rest.slice(breakAt).trim();
    }
    if (rest) lines.push(rest);
    if (!paragraph) lines.push('');
  }
  return lines;
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
  const lines: string[] = [opts.title, ...opts.meta, ''];
  if (opts.rows.length === 0) {
    lines.push('No defects match the current filters.');
  }
  opts.rows.forEach((row, idx) => {
    lines.push(`${idx + 1}. [${row.reference}] ${row.title}`);
    lines.push(
      `   Unit: ${row.unitLabel}  |  Category: ${row.category}  |  Severity: ${row.severity}  |  Status: ${row.status}`,
    );
    for (const d of wrapLines(row.description, 92)) lines.push(`   ${d}`);
    lines.push('');
  });

  const wrapped = lines.flatMap((l) => wrapLines(l, 98));

  const lineHeight = 14;
  const startY = 780;
  const bottomMargin = 48;
  const linesPerPage = Math.max(1, Math.floor((startY - bottomMargin) / lineHeight));
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([]);

  // Object layout: 1 = font; then per page (content, page); then Pages; then Catalog.
  const pagesObjNum = 2 + pages.length * 2;
  const catalogObjNum = pagesObjNum + 1;

  const objBodies: string[] = [
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const pageObjNums: number[] = [];

  pages.forEach((pageLines, p) => {
    const textOps = pageLines
      .map((line, i) => {
        const y = startY - i * lineHeight;
        return `1 0 0 1 50 ${y} Tm (${escapePdfText(line.slice(0, 200))}) Tj`;
      })
      .join('\n');
    const stream = `BT\n/F1 10 Tf\n${textOps}\nET`;
    const streamLen = Buffer.byteLength(stream, 'utf8');
    const contentObjNum = 2 + p * 2;
    const pageObjNum = 3 + p * 2;
    pageObjNums.push(pageObjNum);
    objBodies.push(`<< /Length ${streamLen} >>\nstream\n${stream}\nendstream`);
    objBodies.push(
      `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 1 0 R >> >> >>`,
    );
  });

  objBodies.push(
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  );
  objBodies.push(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);

  const parts: string[] = ['%PDF-1.4\n'];
  const offs: number[] = [0];
  for (let i = 0; i < objBodies.length; i++) {
    offs.push(Buffer.byteLength(parts.join(''), 'utf8'));
    parts.push(`${i + 1} 0 obj\n${objBodies[i]}\nendobj\n`);
  }
  const body = parts.join('');
  const xrefOffset = Buffer.byteLength(body, 'utf8');
  const objCount = objBodies.length + 1;
  let xref = `xref\n0 ${objCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < offs.length; i++) {
    xref += `${String(offs[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objCount} /Root ${catalogObjNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body + xref + trailer, 'utf8');
}
