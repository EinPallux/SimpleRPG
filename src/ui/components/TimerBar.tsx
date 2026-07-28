import type { TimedActivity } from '@/engine/types';
import { formatCountdown } from '../format';

interface TimerBarProps {
  activity: Pick<TimedActivity, 'startedAt' | 'durationSec'>;
  nowMs: number;
  className?: string;
}

/** Progress + countdown derived from timestamps — never counted down in state. */
export function TimerBar({ activity, nowMs, className = '' }: TimerBarProps) {
  const start = Date.parse(activity.startedAt);
  const totalMs = activity.durationSec * 1000;
  const elapsed = Math.max(0, Math.min(totalMs, nowMs - start));
  const pct = totalMs === 0 ? 100 : (elapsed / totalMs) * 100;
  const remainingSec = Math.max(0, (totalMs - elapsed) / 1000);

  return (
    <div className={className}>
      <div className="relative h-5 overflow-hidden rounded-sm border border-black/40 bg-panel-inset">
        <div
          className="h-full bg-gradient-to-b from-[#f0c75e] via-[#d9a94b] to-[#a87d2e] transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,.9)]">
          {remainingSec > 0 ? formatCountdown(remainingSec) : '✓'}
        </span>
      </div>
    </div>
  );
}
