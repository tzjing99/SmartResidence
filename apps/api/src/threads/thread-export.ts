/** Minimal PDF builder for thread export (G2) — no external deps. */
function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLines(text: string, maxLen = 90): string[] {
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

export function buildThreadPdf(opts: {
  title: string;
  meta: string[];
  messages: Array<{ author: string; at: string; body: string; kind?: string }>;
}): Buffer {
  const header = [opts.title, ...opts.meta, '', '--- Messages ---', ''];
  const bodyLines: string[] = [...header];
  for (const m of opts.messages) {
    bodyLines.push(`[${m.at}] ${m.author}${m.kind && m.kind !== 'MESSAGE' ? ` (${m.kind})` : ''}`);
    bodyLines.push(...wrapLines(m.body));
    bodyLines.push('');
  }

  const wrapped = bodyLines.flatMap((l) => wrapLines(l, 95));
  const lineHeight = 14;
  const startY = 780;
  const textOps = wrapped
    .map((line, i) => {
      const y = startY - i * lineHeight;
      if (y < 40) return null;
      return `1 0 0 1 50 ${y} Tm (${escapePdfText(line.slice(0, 120))}) Tj`;
    })
    .filter(Boolean)
    .join('\n');

  const stream = `BT\n/F1 10 Tf\n${textOps}\nET`;
  const streamLen = Buffer.byteLength(stream, 'utf8');

  const parts: string[] = ['%PDF-1.4\n'];
  const offs: number[] = [0];
  const objBodies = [
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${streamLen} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Page /Parent 4 0 R /MediaBox [0 0 612 792] /Contents 2 0 R /Resources << /Font << /F1 1 0 R >> >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Catalog /Pages 4 0 R >>',
  ];
  for (let i = 0; i < objBodies.length; i++) {
    offs.push(Buffer.byteLength(parts.join(''), 'utf8'));
    parts.push(`${i + 1} 0 obj\n${objBodies[i]}\nendobj\n`);
  }
  const body = parts.join('');
  const xrefOffset = Buffer.byteLength(body, 'utf8');
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i < offs.length; i++) {
    xref += `${String(offs[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body + xref + trailer, 'utf8');
}
