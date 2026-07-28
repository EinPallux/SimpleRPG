import { useState } from 'react';
import { bossIntroKey, bossNameKey, DUNGEONS, dungeonSetForClass } from '@/content/dungeons';
import { dungeonStatus, type DungeonStatus } from '@/engine/dungeons';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { formatCountdown } from '../format';
import { useGameClock } from '../hooks/useGameClock';

function WingCard({
  status,
  selected,
  onSelect,
}: {
  status: DungeonStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  const { def, unlocked, cleared, cooldownMs } = status;
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      disabled={!unlocked}
      className={`frame-secondary panel-fill flex flex-col gap-2 p-3 text-left transition-[filter] ${
        selected ? 'brightness-125' : 'enabled:hover:brightness-110'
      } disabled:opacity-60`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`truncate font-display text-sm font-bold ${unlocked ? 'text-ink' : 'text-ink-faint'}`}>
          {t(def.nameKey as I18nKey)}
        </span>
        {!unlocked && <Icon id="lock" size={14} className="shrink-0 text-ink-faint" />}
        {cleared === 10 && <Icon id="crown" size={14} className="shrink-0 text-gold" />}
      </div>
      {unlocked ? (
        <>
          <ProgressBar
            variant="xp"
            value={cleared}
            max={10}
            className="h-2.5"
            label={t('dungeon.floorProgress', { cleared })}
          />
          <span className="text-[10px] font-bold text-ink-faint">
            {cleared === 10
              ? t('dungeon.conquered')
              : cooldownMs > 0
                ? t('dungeon.cooldown', { time: formatCountdown(cooldownMs / 1000) })
                : t('dungeon.ready')}
          </span>
        </>
      ) : (
        <span className="text-[11px] text-ink-faint">
          {t('dungeon.lockedCard', { level: def.unlockLevel })}
        </span>
      )}
    </button>
  );
}

export function DungeonsScreen() {
  const save = useGame((s) => s.save);
  const fight = useGame((s) => s.dungeonFight);
  const now = useGameClock();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!save) return null;

  const statuses = DUNGEONS.map((d) => dungeonStatus(save, d.id, now));
  const fallback = statuses.find((s) => s.unlocked && s.nextFloor !== null) ?? statuses[0]!;
  const selected = selectedId
    ? statuses.find((s) => s.def.id === selectedId) ?? fallback
    : fallback;
  const boss = selected.nextBoss;
  const setName = t(`set.${dungeonSetForClass(selected.def, save.hero.classId)}` as I18nKey);

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary">
        <h1 className="font-display text-2xl font-bold text-gold-bright">{t('dungeons.title')}</h1>
        <p className="text-sm text-ink-muted">{t('dungeons.subtitle')}</p>
      </Panel>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {statuses.map((status) => (
          <WingCard
            key={status.def.id}
            status={status}
            selected={selected.def.id === status.def.id}
            onSelect={() => setSelectedId(status.def.id)}
          />
        ))}
      </div>

      {selected.unlocked && boss && selected.nextFloor !== null ? (
        <Panel variant="secondary" title={t(selected.def.nameKey as I18nKey)}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
                {t('dungeon.nextUp')} ·{' '}
                {t('dungeon.floorProgress', { cleared: selected.nextFloor })}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-display text-xl font-bold text-ink">
                  {t(bossNameKey(boss.slug) as I18nKey)}
                </span>
                <span className="rounded-sm bg-panel-inset px-1.5 py-0.5 text-[11px] font-extrabold text-gold">
                  {t('common.levelShort', { level: selected.nextBossLevel ?? 0 })}
                </span>
                {boss.trait !== 'none' && (
                  <span className="rounded-sm bg-panel-inset px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-teal uppercase">
                    {t(`dungeon.trait.${boss.trait}` as I18nKey)}
                  </span>
                )}
              </div>
              <p className="mt-2 max-w-xl text-sm text-ink-muted italic">
                “{t(bossIntroKey(boss.slug) as I18nKey)}”
              </p>
              <p className="mt-2 text-[11px] text-ink-faint">
                {t('dungeon.setHint', { set: setName })}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              {selected.cooldownMs > 0 ? (
                <span className="text-sm font-bold text-ink-muted">
                  {t('dungeon.cooldown', { time: formatCountdown(selected.cooldownMs / 1000) })}
                </span>
              ) : (
                <FButton size="lg" onClick={() => fight(selected.def.id)}>
                  <Icon id="dungeon" size={18} /> {t('dungeon.fight')}
                </FButton>
              )}
            </div>
          </div>
        </Panel>
      ) : (
        selected.unlocked && (
          <Panel variant="secondary" title={t(selected.def.nameKey as I18nKey)}>
            <p className="flex items-center gap-2 py-2 text-sm font-bold text-gold">
              <Icon id="crown" size={18} /> {t('dungeon.conquered')}
            </p>
          </Panel>
        )
      )}
    </div>
  );
}
