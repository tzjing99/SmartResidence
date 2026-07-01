/** Escape a cell and join rows into a UTF-8 CSV string (RFC-style quoting). */
export function buildCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}
