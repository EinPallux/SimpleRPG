/** Level curve (BALANCING.md §2.1). */

/** XP required to go from level L to L+1: ceil(100 × L^2.4). */
export function xpToNext(level: number): number {
  if (level < 1) throw new Error('level must be >= 1');
  return Math.ceil(100 * Math.pow(level, 2.4));
}
