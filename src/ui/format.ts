/** Number & time formatting helpers (UI_DESIGN.md §2). */
import { t } from '@/i18n';

/** 1,234 → "1,234" · 123456 → "123.4k" · 12345678 → "12.34M" · 1.2e9 → "1.23B" */
export function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs < 100_000) return n.toLocaleString('en-US');
  if (abs < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  if (abs < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}

/** "4:05" under an hour, "1:04:05" above. For countdowns and timers. */
export function formatCountdown(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/**
 * A duration as a human would say it: "30s", "1m 10s", "20 min", "1h 5m".
 *
 * Distinct from {@link formatCountdown}, which is a ticking clock and wants
 * fixed digits. This is for the label on an offer you have not taken yet, where
 * "0:30" reads like a stopwatch and "30s" reads like an answer. It matters now
 * that early missions run in seconds — the board used to print the mission's
 * SIZE with "min" glued to it, so a level-1 hero was told a 70-second errand
 * would take fifteen minutes.
 */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem === 0 ? `${m} min` : `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

/**
 * Vigor, which comes in halves since B2 priced missions at one per minute of
 * clock: "0.5", "1", "1.5", "15". Never "1.0" and never "0.50" — the halves are
 * the only fraction the economy can produce, so a fixed decimal place would put
 * a pointless ".0" on every whole number in the HUD.
 */
export function formatVigor(n: number): string {
  const rounded = Math.round(n * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function relativeTime(iso: string, nowMs: number): string {
  const delta = Math.max(0, nowMs - Date.parse(iso));
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { m: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { h: hours });
  return t('time.daysAgo', { d: Math.floor(hours / 24) });
}
