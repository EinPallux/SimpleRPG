import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CombatResult, Combatant, StrikeEvent } from '@/engine/combat';
import type { ClassId, EmblemSpec } from '@/engine/types';
import { t } from '@/i18n';
import type { IconId } from '../icons.gen';
import { fmt } from '../format';
import { EmblemAvatar } from './EmblemAvatar';
import { FButton } from './FButton';
import { Icon } from './Icon';
import { ProgressBar } from './ProgressBar';

export interface PlaybackSide {
  combatant: Combatant;
  /** player-style portrait… */
  emblem?: EmblemSpec;
  classId?: ClassId;
  /** …or a monster/boss glyph */
  icon?: IconId;
}

function SidePortrait({ side }: { side: PlaybackSide }) {
  if (side.emblem && side.classId) {
    return <EmblemAvatar emblem={side.emblem} classId={side.classId} size={52} />;
  }
  return (
    <span
      className="frame-secondary--muted panel-fill-inset flex h-[52px] w-[52px] shrink-0 items-center justify-center"
      style={{ ['--frame-w' as string]: '8px' }}
    >
      <Icon id={side.icon ?? 'dungeon'} size={30} className="text-ink-muted" />
    </span>
  );
}

interface FlatEvent {
  round: number;
  event: StrikeEvent;
}

const BASE_MS = 650;

function flatten(result: CombatResult): FlatEvent[] {
  const out: FlatEvent[] = [];
  for (const round of result.rounds) {
    for (const event of round.events) out.push({ round: round.round, event });
  }
  return out;
}

function floaterText(event: StrikeEvent): string {
  if (event.outcome === 'blocked') return t('combat.blocked');
  if (event.outcome === 'evaded') return t('combat.evaded');
  return fmt(event.damage);
}

function FighterColumn({
  side,
  hp,
  floater,
  mirrored,
}: {
  side: PlaybackSide;
  hp: number;
  floater: { key: number; event: StrikeEvent } | null;
  mirrored: boolean;
}) {
  const c = side.combatant;
  return (
    <div className={`relative flex min-w-0 flex-1 flex-col gap-2 ${mirrored ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2.5 ${mirrored ? 'flex-row-reverse' : ''}`}>
        <SidePortrait side={side} />
        <div className={`min-w-0 ${mirrored ? 'text-right' : ''}`}>
          <div className="truncate font-display text-sm font-bold text-ink">{c.name}</div>
          <div className="text-[11px] font-bold text-ink-faint">
            {t('common.levelShort', { level: c.level })}
          </div>
        </div>
      </div>
      <ProgressBar
        variant="hp"
        value={hp}
        max={c.maxHp}
        className="h-3.5 w-full"
        label={`${fmt(hp)} / ${fmt(c.maxHp)}`}
      />
      {floater && (
        <div
          key={floater.key}
          aria-hidden="true"
          className={`float-dmg pointer-events-none absolute top-14 left-1/2 font-display font-extrabold [text-shadow:0_2px_4px_#000] ${
            floater.event.outcome === 'crit'
              ? 'text-2xl text-gold-bright'
              : floater.event.outcome === 'hit'
                ? 'text-lg text-[#e0705a]'
                : 'text-sm text-ink-muted italic'
          }`}
        >
          {floaterText(floater.event)}
        </div>
      )}
    </div>
  );
}

/**
 * Auto-battler playback (UI_DESIGN.md §4/§6-22): two portraits, HP bars,
 * floating numbers, round ticker, 1×/2×/skip. Pure replay of a CombatResult —
 * the outcome is already decided; this is the theater. Arena, dungeons and
 * expeditions all share it. `children` renders in the after-fight summary.
 */
export function CombatPlayback({
  a,
  b,
  result,
  onDone,
  children,
}: {
  a: PlaybackSide;
  b: PlaybackSide;
  result: CombatResult;
  onDone: () => void;
  children?: ReactNode;
}) {
  const flat = useMemo(() => flatten(result), [result]);
  const [idx, setIdx] = useState(0); // events applied so far
  const [speed, setSpeed] = useState<1 | 2>(1);
  const done = idx >= flat.length;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => setIdx((i) => i + 1), BASE_MS / speed);
    return () => clearTimeout(id);
  }, [idx, speed, done]);

  const hp = useMemo<[number, number]>(() => {
    const state: [number, number] = [a.combatant.maxHp, b.combatant.maxHp];
    for (let i = 0; i < idx; i++) {
      const e = flat[i]!.event;
      state[1 - e.attacker] = e.targetHpAfter;
    }
    return state;
  }, [idx, flat, a.combatant.maxHp, b.combatant.maxHp]);

  const last = idx > 0 ? flat[idx - 1]! : null;
  const round = last ? last.round : 1;
  const names = [a.combatant.name, b.combatant.name] as const;

  const summary = useMemo(() => {
    const dealt: [number, number] = [0, 0];
    const biggestCrit: [number, number] = [0, 0];
    for (const { event } of flat) {
      dealt[event.attacker] += event.damage;
      if (event.outcome === 'crit') {
        biggestCrit[event.attacker] = Math.max(biggestCrit[event.attacker], event.damage);
      }
    }
    return { dealt, biggestCrit };
  }, [flat]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        if (done) onDone();
        else setIdx(flat.length);
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${names[0]} vs ${names[1]}`}
        className="frame-primary panel-fill w-full max-w-xl p-5 outline-none screen-enter"
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <span className="font-display text-sm font-bold tracking-wider text-ink-muted uppercase">
            {t('combat.round', { round })}
          </span>
          {!done && (
            <div className="flex items-center gap-1.5">
              <span className="sr-only">{t('combat.speedLabel')}</span>
              {([1, 2] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={`rounded-sm px-2 py-0.5 text-xs font-extrabold ${
                    speed === s ? 'bg-panel-inset text-gold' : 'text-ink-faint hover:text-ink'
                  }`}
                >
                  {s}×
                </button>
              ))}
              <FButton variant="quiet" size="sm" onClick={() => setIdx(flat.length)}>
                {t('combat.skip')}
              </FButton>
            </div>
          )}
        </header>

        <div className="flex items-start gap-4">
          <FighterColumn side={a} hp={hp[0]} floater={last?.event.attacker === 1 ? { key: idx, event: last.event } : null} mirrored={false} />
          <div className="mt-4 shrink-0 font-display text-lg font-extrabold text-ink-faint">⚔</div>
          <FighterColumn side={b} hp={hp[1]} floater={last?.event.attacker === 0 ? { key: idx, event: last.event } : null} mirrored={true} />
        </div>

        {/* Screen-reader play-by-play; visually the floaters carry it. */}
        <div aria-live="polite" className="sr-only">
          {last &&
            t('combat.liveLine', {
              round,
              attacker: names[last.event.attacker],
              outcome: t(`combat.outcome.${last.event.outcome}`),
              damage: last.event.damage,
            })}
        </div>

        {done && (
          <div className="mt-5 border-t border-ink-faint/20 pt-4 screen-enter">
            <div className="flex items-center gap-2">
              <Icon id="crown" size={20} className="text-gold" />
              <span className="font-display text-lg font-bold text-gold-bright">
                {t('combat.winner', { name: names[result.winner] })}
              </span>
            </div>
            {result.tieBreak && (
              <p className="mt-1 text-xs text-ink-muted italic">{t('arena.tieBreak')}</p>
            )}
            <p className="mt-2 text-[11px] text-ink-faint">
              {t('combat.summary.rounds', { rounds: result.rounds.length })} ·{' '}
              {t('combat.summary.dealt', { name: names[0], damage: fmt(summary.dealt[0]) })}
              {summary.biggestCrit[0] > 0 &&
                ` (${t('combat.summary.biggestCrit', { damage: fmt(summary.biggestCrit[0]) })})`}{' '}
              · {t('combat.summary.dealt', { name: names[1], damage: fmt(summary.dealt[1]) })}
              {summary.biggestCrit[1] > 0 &&
                ` (${t('combat.summary.biggestCrit', { damage: fmt(summary.biggestCrit[1]) })})`}
            </p>
            {children}
            <div className="mt-4 flex justify-end">
              <FButton onClick={onDone} autoFocus>
                {t('combat.continue')}
              </FButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
