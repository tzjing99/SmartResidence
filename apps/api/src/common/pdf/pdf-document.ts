/**
 * Shared, dependency-free PDF layout engine for SmartResidence documents.
 *
 * All auto-generated PDFs (billing receipts, helpdesk thread transcripts,
 * defect schedules and handover reports) render through this single module so
 * they share one consistent, modern visual system: a branded header band,
 * clear typographic hierarchy, aligned label/value rows, tables with
 * right-aligned money, subtle divider rules, a clean totals block and a
 * professional running footer.
 *
 * It emits a minimal but valid PDF 1.4 document using only the core Helvetica
 * fonts — no images and no external dependencies — so it renders anywhere and
 * pulls in zero packages. Text metrics use the standard Adobe Helvetica AFM
 * advance widths, which lets us align columns, right-align currency and centre
 * text accurately.
 *
 * Layout is A4, print-friendly and monochrome-safe (the default brand colour is
 * a dark slate that degrades gracefully to grey when printed without colour).
 */

// A4 in PostScript points (72dpi).
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

/** RGB colour, each channel 0..1. */
export interface PdfColor {
  r: number;
  g: number;
  b: number;
}

const rgb = (r: number, g: number, b: number): PdfColor => ({ r: r / 255, g: g / 255, b: b / 255 });

/** Shared palette. Chosen to stay legible when printed in greyscale. */
export const PDF_COLORS = {
  brand: rgb(31, 41, 55), // slate-800, the default header band
  ink: rgb(17, 24, 39), // near-black body text
  muted: rgb(107, 114, 128), // secondary labels / captions
  hairline: rgb(226, 232, 240), // subtle divider rules
  bandText: rgb(255, 255, 255),
  bandSubtext: rgb(203, 213, 225),
  zebra: rgb(247, 249, 252), // faint table row shading
  tableHeadBg: rgb(241, 245, 249),
} as const;

const FONT_REGULAR = 'F1';
const FONT_BOLD = 'F2';

/** Standard Adobe Helvetica advance widths (units/1000) for ASCII 32..126. */
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Standard Adobe Helvetica-Bold advance widths (units/1000) for ASCII 32..126. */
const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

function charWidth(code: number, bold: boolean): number {
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  const fallback = bold ? 556 : 500; // for anything outside printable ASCII
  if (code >= 32 && code <= 126) return table[code - 32] ?? fallback;
  return fallback;
}

/** Width of `text` at `size` pt in the given weight, in points. */
export function measureText(text: string, size: number, bold = false): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) units += charWidth(text.charCodeAt(i), bold);
  return (units / 1000) * size;
}

/** Common Unicode punctuation → WinAnsi (CP1252) byte values. */
const WINANSI_PUNCT = new Map<number, number>([
  [0x20ac, 0x80], // €
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x2030, 0x89], // ‰
  [0x2039, 0x8b], // ‹
  [0x2018, 0x91], // ‘
  [0x2019, 0x92], // ’
  [0x201c, 0x93], // “
  [0x201d, 0x94], // ”
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x2122, 0x99], // ™
  [0x203a, 0x9b], // ›
]);

/** Map a code point to a WinAnsi byte, or null when it has no representation. */
function toWinAnsiByte(cp: number): number | null {
  if (cp === 0x0a || cp === 0x0d || cp === 0x09) return 0x20; // normalise whitespace
  if (cp >= 0x20 && cp <= 0x7e) return cp; // printable ASCII
  const mapped = WINANSI_PUNCT.get(cp);
  if (mapped != null) return mapped;
  if (cp >= 0xa0 && cp <= 0xff) return cp; // Latin-1 supplement matches WinAnsi
  return null;
}

/**
 * Encode to a WinAnsi byte-string (each char code is a single output byte) and
 * escape the PDF string delimiters. The document is serialised as latin1 so
 * these bytes are written verbatim.
 */
function escapePdfText(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0x3f;
    const byte = toWinAnsiByte(cp) ?? 0x3f; // '?' for anything unrepresentable
    if (byte === 0x28) out += '\\(';
    else if (byte === 0x29) out += '\\)';
    else if (byte === 0x5c) out += '\\\\';
    else out += String.fromCharCode(byte);
  }
  return out;
}

/** Truncate to fit `maxWidth`, appending an ellipsis when clipped. */
export function ellipsize(text: string, size: number, bold: boolean, maxWidth: number): string {
  if (measureText(text, size, bold) <= maxWidth) return text;
  const ell = '...';
  let out = text;
  while (out.length > 1 && measureText(out + ell, size, bold) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + ell;
}

/** Greedy word-wrap `text` (honouring existing newlines) to `maxWidth` points. */
export function wrapText(text: string, size: number, bold: boolean, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      out.push('');
      continue;
    }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(candidate, size, bold) <= maxWidth || !line) {
        // A single word longer than the line is hard-broken by character.
        if (!line && measureText(word, size, bold) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (measureText(chunk + ch, size, bold) > maxWidth && chunk) {
              out.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
        } else {
          line = candidate;
        }
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

type Align = 'left' | 'right' | 'center';

export interface TextRun {
  text: string;
  size?: number;
  bold?: boolean;
  color?: PdfColor;
  align?: Align;
}

/** A single table column definition. */
export interface PdfTableColumn {
  header: string;
  /** Fraction of the table width (columns should sum to ~1). */
  width: number;
  align?: Align;
  bold?: boolean;
}

export interface PdfTableOptions {
  columns: PdfTableColumn[];
  rows: string[][];
  fontSize?: number;
  zebra?: boolean;
}

export interface PdfHeaderOptions {
  /** Brand / organisation / condo name shown large in the header band. */
  brand: string;
  /** Document type or subject shown beneath the brand inside the band. */
  title: string;
  /** Optional third line, e.g. a reference or generated timestamp. */
  subtitle?: string;
}

export interface PdfDocumentOptions {
  header: PdfHeaderOptions;
  /** Optional brand colour; falls back to the shared slate when omitted. */
  brandColor?: PdfColor;
  /** Footer note printed on every page (left aligned). */
  footerNote?: string;
  /** Right-aligned footer caption; defaults to a computer-generated notice. */
  footerCaption?: string;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
}

interface PageState {
  ops: string[];
}

/**
 * Flow-based document builder. Callers append blocks top-to-bottom; the builder
 * measures each block, breaks to a new page when needed, and paints a branded
 * header on every page plus a footer with page numbers at build time.
 */
export class PdfDocument {
  private readonly margin: { top: number; right: number; bottom: number; left: number };
  private readonly brandColor: PdfColor;
  private readonly pages: PageState[] = [];
  private page!: PageState;
  private y = 0;

  private static readonly BAND_HEIGHT = 74;
  private static readonly CONT_BAND_HEIGHT = 34;
  private static readonly FOOTER_RESERVE = 42;

  constructor(private readonly opts: PdfDocumentOptions) {
    this.margin = {
      top: opts.margin?.top ?? 48,
      right: opts.margin?.right ?? 52,
      bottom: opts.margin?.bottom ?? 52,
      left: opts.margin?.left ?? 52,
    };
    this.brandColor = opts.brandColor ?? PDF_COLORS.brand;
    this.startPage(true);
  }

  private get left(): number {
    return this.margin.left;
  }

  private get right(): number {
    return PAGE_WIDTH - this.margin.right;
  }

  private get contentWidth(): number {
    return this.right - this.left;
  }

  private get bottomLimit(): number {
    return this.margin.bottom + PdfDocument.FOOTER_RESERVE;
  }

  private startPage(first: boolean): void {
    this.page = { ops: [] };
    this.pages.push(this.page);
    if (first) {
      this.drawBandHeader();
      this.y = PAGE_HEIGHT - PdfDocument.BAND_HEIGHT - 24;
    } else {
      this.drawContinuationHeader();
      this.y = PAGE_HEIGHT - PdfDocument.CONT_BAND_HEIGHT - 22;
    }
  }

  /** Ensure `height` points are available below the cursor, else break page. */
  private ensure(height: number): void {
    if (this.y - height < this.bottomLimit) this.startPage(false);
  }

  private fillRect(x: number, y: number, w: number, h: number, color: PdfColor): void {
    this.page.ops.push(
      `${color.r.toFixed(3)} ${color.g.toFixed(3)} ${color.b.toFixed(3)} rg`,
      `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`,
    );
  }

  private strokeLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: PdfColor,
    width = 0.75,
  ): void {
    this.page.ops.push(
      `${width.toFixed(2)} w`,
      `${color.r.toFixed(3)} ${color.g.toFixed(3)} ${color.b.toFixed(3)} RG`,
      `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    );
  }

  private drawText(
    x: number,
    baseline: number,
    text: string,
    size: number,
    bold: boolean,
    color: PdfColor,
    align: Align = 'left',
    boxWidth?: number,
  ): void {
    if (!text) return;
    let tx = x;
    if (align !== 'left' && boxWidth != null) {
      const w = measureText(text, size, bold);
      tx = align === 'right' ? x + boxWidth - w : x + (boxWidth - w) / 2;
    }
    const font = bold ? FONT_BOLD : FONT_REGULAR;
    this.page.ops.push(
      `${color.r.toFixed(3)} ${color.g.toFixed(3)} ${color.b.toFixed(3)} rg`,
      `BT /${font} ${size} Tf 1 0 0 1 ${tx.toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`,
    );
  }

  private drawBandHeader(): void {
    const bandTop = PAGE_HEIGHT;
    const h = PdfDocument.BAND_HEIGHT;
    this.fillRect(0, bandTop - h, PAGE_WIDTH, h, this.brandColor);
    const { brand, title, subtitle } = this.opts.header;
    this.drawText(this.left, bandTop - 30, brand, 17, true, PDF_COLORS.bandText);
    this.drawText(this.left, bandTop - 48, title.toUpperCase(), 10.5, true, PDF_COLORS.bandSubtext);
    if (subtitle) {
      this.drawText(
        this.right,
        bandTop - 30,
        subtitle,
        9,
        false,
        PDF_COLORS.bandSubtext,
        'right',
        0,
      );
    }
    // Thin accent rule just under the band for extra polish.
    this.strokeLine(0, bandTop - h, PAGE_WIDTH, bandTop - h, this.brandColor, 2);
  }

  private drawContinuationHeader(): void {
    const bandTop = PAGE_HEIGHT;
    const h = PdfDocument.CONT_BAND_HEIGHT;
    this.drawText(this.left, bandTop - 22, this.opts.header.brand, 10, true, PDF_COLORS.ink);
    this.drawText(
      this.right,
      bandTop - 22,
      this.opts.header.title,
      9,
      false,
      PDF_COLORS.muted,
      'right',
      0,
    );
    this.strokeLine(this.left, bandTop - h, this.right, bandTop - h, PDF_COLORS.hairline, 1);
  }

  // ---- Public flow API -----------------------------------------------------

  /** Vertical whitespace. */
  spacer(height = 10): this {
    this.ensure(height);
    this.y -= height;
    return this;
  }

  /** A section heading with a short underline accent. */
  sectionTitle(text: string): this {
    this.ensure(26);
    this.y -= 16;
    this.drawText(this.left, this.y, text.toUpperCase(), 10.5, true, this.brandColor);
    this.y -= 6;
    this.strokeLine(this.left, this.y, this.left + 34, this.y, this.brandColor, 1.5);
    this.y -= 8;
    return this;
  }

  /** Full-width hairline divider. */
  divider(): this {
    this.ensure(12);
    this.y -= 8;
    this.strokeLine(this.left, this.y, this.right, this.y, PDF_COLORS.hairline, 1);
    this.y -= 4;
    return this;
  }

  /** A left-aligned paragraph, wrapped to the content width. */
  paragraph(text: string, opts: { size?: number; bold?: boolean; color?: PdfColor } = {}): this {
    const size = opts.size ?? 10;
    const bold = opts.bold ?? false;
    const color = opts.color ?? PDF_COLORS.ink;
    const lineHeight = size + 4;
    for (const line of wrapText(text, size, bold, this.contentWidth)) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      this.drawText(this.left, this.y, line, size, bold, color);
    }
    return this;
  }

  /** A muted label with its value on the same row (value can wrap). */
  labelValue(label: string, value: string, opts: { labelWidth?: number } = {}): this {
    const size = 10;
    const lineHeight = size + 5;
    const labelWidth = opts.labelWidth ?? 120;
    const valueX = this.left + labelWidth;
    const valueWidth = this.right - valueX;
    const lines = wrapText(value || '-', size, false, valueWidth);
    this.ensure(lineHeight * Math.max(1, lines.length));
    lines.forEach((line, i) => {
      this.y -= lineHeight;
      if (i === 0) this.drawText(this.left, this.y, label, size, false, PDF_COLORS.muted);
      this.drawText(valueX, this.y, line, size, false, PDF_COLORS.ink);
    });
    return this;
  }

  /** A prominent label/amount row used for the receipt total. */
  amountHighlight(label: string, amount: string): this {
    const h = 40;
    this.ensure(h);
    this.y -= h;
    this.fillRect(this.left, this.y, this.contentWidth, h - 6, PDF_COLORS.tableHeadBg);
    const baseline = this.y + 14;
    this.drawText(this.left + 14, baseline, label.toUpperCase(), 10, true, PDF_COLORS.muted);
    this.drawText(
      this.left,
      baseline - 1,
      amount,
      18,
      true,
      PDF_COLORS.ink,
      'right',
      this.contentWidth - 14,
    );
    return this;
  }

  /** A right-aligned totals block (label left, value right; last row bold). */
  totals(rows: Array<{ label: string; value: string; emphasize?: boolean }>): this {
    const size = 10;
    const lineHeight = size + 8;
    const blockWidth = 240;
    const blockLeft = this.right - blockWidth;
    for (const row of rows) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      const bold = row.emphasize ?? false;
      const color = bold ? PDF_COLORS.ink : PDF_COLORS.muted;
      if (bold) {
        this.strokeLine(
          blockLeft,
          this.y + lineHeight - 4,
          this.right,
          this.y + lineHeight - 4,
          PDF_COLORS.hairline,
          1,
        );
      }
      this.drawText(blockLeft, this.y, row.label, size, bold, color);
      this.drawText(
        blockLeft,
        this.y,
        row.value,
        size + (bold ? 1 : 0),
        bold,
        PDF_COLORS.ink,
        'right',
        blockWidth,
      );
    }
    return this;
  }

  /** A table with aligned columns; header row is shaded, body rows optionally zebra-striped. */
  table(options: PdfTableOptions): this {
    const size = options.fontSize ?? 9.5;
    const zebra = options.zebra ?? true;
    const cellPadX = 6;
    const cellPadY = 5;
    const lineHeight = size + 3;
    const totalUnits = options.columns.reduce((s, c) => s + c.width, 0) || 1;
    const widths = options.columns.map((c) => (c.width / totalUnits) * this.contentWidth);
    const xs: number[] = [];
    let acc = this.left;
    for (const w of widths) {
      xs.push(acc);
      acc += w;
    }

    const drawHeader = (): void => {
      const headerHeight = lineHeight + cellPadY * 2;
      this.ensure(headerHeight);
      this.y -= headerHeight;
      this.fillRect(this.left, this.y, this.contentWidth, headerHeight, PDF_COLORS.tableHeadBg);
      const baseline = this.y + cellPadY + 1;
      options.columns.forEach((col, i) => {
        const cellW = (widths[i] ?? 0) - cellPadX * 2;
        const text = ellipsize(col.header, size, true, cellW);
        this.drawText(
          (xs[i] ?? this.left) + cellPadX,
          baseline,
          text,
          size,
          true,
          PDF_COLORS.ink,
          col.align ?? 'left',
          cellW,
        );
      });
    };

    drawHeader();
    options.rows.forEach((row, rowIdx) => {
      const wrapped = options.columns.map((col, i) => {
        const cellW = (widths[i] ?? 0) - cellPadX * 2;
        // Money/short columns are clipped; the wide text columns wrap.
        return col.align === 'right' || cellW < 90
          ? [ellipsize(row[i] ?? '', size, col.bold ?? false, cellW)]
          : wrapText(row[i] ?? '', size, col.bold ?? false, cellW);
      });
      const rowLines = Math.max(1, ...wrapped.map((w) => w.length));
      const rowHeight = rowLines * lineHeight + cellPadY * 2 - 2;
      if (this.y - rowHeight < this.bottomLimit) {
        this.startPage(false);
        drawHeader();
      }
      this.y -= rowHeight;
      if (zebra && rowIdx % 2 === 1) {
        this.fillRect(this.left, this.y, this.contentWidth, rowHeight, PDF_COLORS.zebra);
      }
      const topBaseline = this.y + rowHeight - cellPadY - size + 1;
      options.columns.forEach((col, i) => {
        const cellW = (widths[i] ?? 0) - cellPadX * 2;
        (wrapped[i] ?? []).forEach((line, li) => {
          this.drawText(
            (xs[i] ?? this.left) + cellPadX,
            topBaseline - li * lineHeight,
            line,
            size,
            col.bold ?? false,
            PDF_COLORS.ink,
            col.align ?? 'left',
            cellW,
          );
        });
      });
      this.strokeLine(this.left, this.y, this.right, this.y, PDF_COLORS.hairline, 0.5);
    });
    return this;
  }

  /** A signature line with a printed name and title beneath. */
  signature(name?: string, title?: string): this {
    this.ensure(44);
    this.y -= 30;
    this.strokeLine(this.left, this.y, this.left + 200, this.y, PDF_COLORS.ink, 0.75);
    this.y -= 14;
    if (name) this.drawText(this.left, this.y, name, 10, true, PDF_COLORS.ink);
    if (title) {
      this.y -= 12;
      this.drawText(this.left, this.y, title, 9, false, PDF_COLORS.muted);
    }
    return this;
  }

  /** A framed callout box (used for the e-invoice / QR placeholder). */
  calloutBox(lines: TextRun[], opts: { qrPlaceholder?: string } = {}): this {
    const innerPad = 12;
    const gap = 4;
    const measured = lines.map((l) => ({
      run: l,
      size: l.size ?? 9,
      lineHeight: (l.size ?? 9) + gap,
    }));
    const textHeight = measured.reduce((s, m) => s + m.lineHeight, 0);
    const qrSize = opts.qrPlaceholder ? 72 : 0;
    const boxHeight = Math.max(textHeight, qrSize) + innerPad * 2;
    this.ensure(boxHeight + 8);
    this.y -= 8;
    const boxTop = this.y;
    const boxBottom = this.y - boxHeight;
    // Box outline.
    this.strokeLine(this.left, boxTop, this.right, boxTop, PDF_COLORS.hairline, 1);
    this.strokeLine(this.left, boxBottom, this.right, boxBottom, PDF_COLORS.hairline, 1);
    this.strokeLine(this.left, boxTop, this.left, boxBottom, PDF_COLORS.hairline, 1);
    this.strokeLine(this.right, boxTop, this.right, boxBottom, PDF_COLORS.hairline, 1);
    const textRight = opts.qrPlaceholder ? this.right - qrSize - innerPad * 2 : this.right;
    let cursor = boxTop - innerPad;
    for (const m of measured) {
      cursor -= m.size;
      const color = m.run.color ?? PDF_COLORS.ink;
      const maxW = textRight - (this.left + innerPad);
      this.drawText(
        this.left + innerPad,
        cursor,
        ellipsize(m.run.text, m.size, m.run.bold ?? false, maxW),
        m.size,
        m.run.bold ?? false,
        color,
      );
      cursor -= gap;
    }
    if (opts.qrPlaceholder) {
      const qx = this.right - innerPad - qrSize;
      const qy = boxTop - innerPad - qrSize;
      this.strokeLine(
        qx,
        boxTop - innerPad,
        qx + qrSize,
        boxTop - innerPad,
        PDF_COLORS.muted,
        0.75,
      );
      this.strokeLine(qx, qy, qx + qrSize, qy, PDF_COLORS.muted, 0.75);
      this.strokeLine(qx, boxTop - innerPad, qx, qy, PDF_COLORS.muted, 0.75);
      this.strokeLine(qx + qrSize, boxTop - innerPad, qx + qrSize, qy, PDF_COLORS.muted, 0.75);
      const cap = 'QR';
      this.drawText(qx, qy + qrSize / 2, cap, 8, true, PDF_COLORS.muted, 'center', qrSize);
      this.drawText(
        qx,
        qy + qrSize / 2 - 12,
        opts.qrPlaceholder,
        6,
        false,
        PDF_COLORS.muted,
        'center',
        qrSize,
      );
    }
    this.y = boxBottom;
    return this;
  }

  // ---- Emit -----------------------------------------------------------------

  private drawFooters(): void {
    const total = this.pages.length;
    const y = this.margin.bottom - 16;
    const caption = this.opts.footerCaption ?? 'This is a computer-generated document.';
    this.pages.forEach((page, idx) => {
      const savedPage = this.page;
      this.page = page;
      this.strokeLine(
        this.left,
        this.margin.bottom - 2,
        this.right,
        this.margin.bottom - 2,
        PDF_COLORS.hairline,
        0.75,
      );
      if (this.opts.footerNote) {
        this.drawText(this.left, y, this.opts.footerNote, 8, false, PDF_COLORS.muted);
      }
      this.drawText(this.left, y - 10, caption, 7.5, false, PDF_COLORS.muted);
      this.drawText(
        this.left,
        y,
        `Page ${idx + 1} of ${total}`,
        8,
        false,
        PDF_COLORS.muted,
        'right',
        this.contentWidth,
      );
      this.page = savedPage;
    });
  }

  /** Serialise the accumulated pages to a valid PDF 1.4 byte buffer. */
  build(): Buffer {
    this.drawFooters();

    const pageCount = this.pages.length;
    // Object numbering:
    //  1 = Helvetica, 2 = Helvetica-Bold
    //  then per page: content stream + page object
    //  then Pages, then Catalog.
    const pagesObjNum = 3 + pageCount * 2;
    const catalogObjNum = pagesObjNum + 1;

    const objBodies: string[] = [
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];
    const pageObjNums: number[] = [];

    this.pages.forEach((page, p) => {
      const stream = page.ops.join('\n');
      const streamLen = Buffer.byteLength(stream, 'latin1');
      const contentObjNum = 3 + p * 2;
      const pageObjNum = 4 + p * 2;
      pageObjNums.push(pageObjNum);
      objBodies.push(`<< /Length ${streamLen} >>\nstream\n${stream}\nendstream`);
      objBodies.push(
        `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 1 0 R /F2 2 0 R >> >> >>`,
      );
    });

    objBodies.push(
      `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    );
    objBodies.push(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);

    const parts: string[] = ['%PDF-1.4\n'];
    const offs: number[] = [0];
    for (let i = 0; i < objBodies.length; i++) {
      offs.push(Buffer.byteLength(parts.join(''), 'latin1'));
      parts.push(`${i + 1} 0 obj\n${objBodies[i]}\nendobj\n`);
    }
    const body = parts.join('');
    const xrefOffset = Buffer.byteLength(body, 'latin1');
    const objCount = objBodies.length + 1;
    let xref = `xref\n0 ${objCount}\n0000000000 65535 f \n`;
    for (let i = 1; i < offs.length; i++) {
      xref += `${String(offs[i]).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${objCount} /Root ${catalogObjNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(body + xref + trailer, 'latin1');
  }
}
