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

export function relativeTime(iso: string, nowMs: number): string {
  const delta = Math.max(0, nowMs - Date.parse(iso));
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { m: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { h: hours });
  return t('time.daysAgo', { d: Math.floor(hours / 24) });
}
