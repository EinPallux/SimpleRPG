import { useEffect, useRef, useState } from 'react';
import { WHEEL_SLOTS } from '@/content/wheel';
import { WHEEL_SPINS_PER_DAY } from '@/engine/constants';
import type { WheelOutcome } from '@/engine/wheel';
import { canSpinWheel, wheelSpinCost, wheelSpinsLeft } from '@/engine/wheel';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { CurrencyChip } from '../components/CurrencyChip';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { ItemCard } from '../components/ItemCard';
import { Panel } from '../components/Panel';
import { fmt } from '../format';

const SEG = 360 / WHEEL_SLOTS.length;
const WHEEL_COLORS = ['#1b2838', '#232f42'];
const POINTER_EXTRA_TURNS = 4;

/** The 12 segments as a conic gradient — no canvas, no sprites. */
function wheelBackground(): string {
  const stops = WHEEL_SLOTS.map((slot, i) => {
    const color =
      slot.kind === 'jackpot'
        ? '#8a6d27'
        : slot.kind === 'gem'
          ? '#274d49'
          : WHEEL_COLORS[i % 2]!;
    return `${color} ${i * SEG}deg ${(i + 1) * SEG}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function barkFor(outcome: WheelOutcome): string {
  if (outcome.kind === 'jackpot') return t('wheel.bark.jackpot');
  if (outcome.kind === 'salute') return t('wheel.bark.salute');
  if (outcome.mystery) return t('wheel.bark.mystery');
  return t(`wheel.bark.${outcome.slotIndex % 4}` as I18nKey);
}

function OutcomeLines({ outcome }: { outcome: WheelOutcome }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-center text-sm font-bold text-gold-bright">
        {t(WHEEL_SLOTS[outcome.slotIndex]!.labelKey as I18nKey)}
        {outcome.mystery ? ' ×2' : ''}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-bold">
        {outcome.gold > 0 && (
          <span className="inline-flex items-center gap-1 text-gold">
            <Icon id="gold" size={14} /> {t('arena.reward.gold', { gold: fmt(outcome.gold) })}
          </span>
        )}
        {outcome.xp && (
          <span className="text-xp">{t('arena.reward.xp', { xp: fmt(outcome.xp.gained) })}</span>
        )}
        {outcome.scraps > 0 && (
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <Icon id="scraps" size={14} /> {t('wheel.result.scraps', { n: outcome.scraps })}
          </span>
        )}
        {outcome.treats > 0 && (
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <Icon id="treats" size={14} /> {t('wheel.result.treats', { n: outcome.treats })}
          </span>
        )}
        {outcome.dust > 0 && (
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <Icon id="dust" size={14} /> {t('wheel.result.dust', { n: outcome.dust })}
          </span>
        )}
        {outcome.gems > 0 && (
          <span className="inline-flex items-center gap-1 text-gem">
            <Icon id="gem" size={14} /> {t('wheel.result.gem', { n: outcome.gems })}
          </span>
        )}
      </div>
      {outcome.items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
      {outcome.autoSoldGold > 0 && (
        <p className="text-xs font-semibold text-ink-muted">
          {t('arena.reward.chestSold', { gold: fmt(outcome.autoSoldGold) })}
        </p>
      )}
    </div>
  );
}

export function WheelScreen() {
  const save = useGame((s) => s.save);
  const spin = useGame((s) => s.wheelSpin);
  const outcome = useGame((s) => s.wheelOutcome);
  const closeOutcome = useGame((s) => s.closeWheelOutcome);
  const [rotation, setRotation] = useState(0);
  const [settled, setSettled] = useState(true);
  const spinToken = useRef(0);

  // A new outcome spins the pointer to its slot; the reveal waits for the stop.
  useEffect(() => {
    if (!outcome) return;
    const token = ++spinToken.current;
    setSettled(false);
    const target = outcome.slotIndex * SEG + SEG / 2;
    setRotation((prev) => {
      const base = Math.ceil(prev / 360) * 360;
      return base + POINTER_EXTRA_TURNS * 360 + (360 - target);
    });
    const id = setTimeout(() => {
      if (spinToken.current === token) setSettled(true);
    }, 2300);
    return () => clearTimeout(id);
  }, [outcome]);

  if (!save) return null;
  const left = wheelSpinsLeft(save);
  const cost = wheelSpinCost(save);
  const spinnable = canSpinWheel(save) && (outcome === null || settled);

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="special">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">
              {t('wheel.title')}
            </h1>
            <p className="text-sm text-ink-muted">{t('wheel.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
              {t('wheel.left')}
            </span>
            {Array.from({ length: WHEEL_SPINS_PER_DAY }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full border border-black/50 ${i < left ? 'bg-gold' : 'bg-panel-inset'}`}
              />
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Panel variant="secondary" className="flex flex-col items-center gap-4 py-6">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 text-gold-bright [text-shadow:0_2px_4px_#000]"
            >
              ▼
            </div>
            <div
              role="img"
              aria-label={t('wheel.title')}
              className="h-64 w-64 rounded-full border-4 border-black/60 shadow-[inset_0_0_30px_rgba(0,0,0,.6)] md:h-72 md:w-72"
              style={{
                background: wheelBackground(),
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 2.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {WHEEL_SLOTS.map((slot, i) => (
                <span
                  key={slot.kind}
                  aria-hidden="true"
                  className="absolute top-1/2 left-1/2 text-[13px]"
                  style={{
                    transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-105px)`,
                    transformOrigin: '0 0',
                  }}
                >
                  {slot.kind === 'jackpot'
                    ? '👑'
                    : slot.kind === 'gem'
                      ? '💎'
                      : slot.kind.startsWith('gold')
                        ? '🪙'
                        : slot.kind === 'mystery'
                          ? '❓'
                          : slot.kind === 'salute'
                            ? '🫡'
                            : slot.kind === 'xp'
                              ? '✨'
                              : slot.kind === 'treats'
                                ? '🦴'
                                : slot.kind === 'dust'
                                  ? '🌫️'
                                  : slot.kind === 'item'
                                    ? '🎁'
                                    : '⚙️'}
                </span>
              ))}
            </div>
          </div>

          {outcome && settled ? (
            <>
              <p className="max-w-md text-center text-sm text-ink italic">“{barkFor(outcome)}”</p>
              <OutcomeLines outcome={outcome} />
              <FButton onClick={closeOutcome}>{t('common.close')}</FButton>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FButton size="lg" disabled={!spinnable} onClick={spin}>
                <Icon id="wheel" size={18} /> {t('wheel.spin')}
                {cost !== null && (
                  <span className="text-xs font-bold text-ink-muted">
                    {cost === 0 ? `(${t('wheel.free')})` : `(${fmt(cost)} 🪙)`}
                  </span>
                )}
              </FButton>
              {cost !== null && cost > 0 && <CurrencyChip kind="gold" value={save.hero.gold} />}
            </div>
          )}
        </Panel>

        <Panel variant="inset" title={t('wheel.odds')}>
          <ul className="space-y-1">
            {WHEEL_SLOTS.map((slot) => (
              <li
                key={slot.kind}
                className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-muted"
              >
                <span className="truncate">{t(slot.labelKey as I18nKey)}</span>
                <span className="shrink-0 text-ink-faint">{slot.weight}%</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
