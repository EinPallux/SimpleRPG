/**
 * Calendar boundary helpers (TECHNICAL_ARCHITECTURE.md §6). All resets use the
 * player's LOCAL time: daily at midnight, weekly on Monday, monthly on the 1st
 * (GAME_DESIGN.md §14). Pure functions of a millisecond timestamp.
 */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day, e.g. "2026-07-28". */
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local month, e.g. "2026-07". */
export function localMonthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/**
 * ISO-8601 week (Monday-start, week 1 contains the first Thursday),
 * e.g. "2026-W31". Weekly quests and the Featured Banner rotate on this.
 */
export function isoWeekKey(ms: number): string {
  const d = new Date(ms);
  // Work on a UTC copy of the local calendar date to avoid DST arithmetic.
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() === 0 ? 7 : t.getUTCDay();
  t.setUTCDate(t.getUTCDate() + 4 - dayNum); // shift to the week's Thursday
  const isoYear = t.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${pad(week)}`;
}

/** Milliseconds from `ms` until the next local midnight (> 0). */
export function msUntilNextLocalMidnight(ms: number): number {
  const d = new Date(ms);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - ms;
}
