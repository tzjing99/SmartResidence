/** Compact duration since check-in for guard live board (e.g. "42m", "2h 15m"). */
export function formatTimeOnSite(checkedInAt: Date, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - checkedInAt.getTime()) / 60_000));
  if (mins < 1) return '0m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}
