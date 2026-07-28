import { useMemo } from 'react';
import {
  botCombatant,
  botDisplayGear,
  botSnapshot,
  worldDayIndex,
  type BotSnapshot,
} from '@/engine/botworld';
import { ATTRIBUTE_IDS, type GameSave } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { fmt } from '../format';
import { itemName } from '../itemName';
import { RARITY_TEXT } from '../rarity';
import { EmblemAvatar } from './EmblemAvatar';
import { FButton } from './FButton';
import { Icon } from './Icon';
import { Modal } from './Modal';

/** 14-day honor history, recomputed from the deterministic world — no storage. */
function Sparkline({ worldSeed, bot, dayIndex }: { worldSeed: string; bot: BotSnapshot; dayIndex: number }) {
  const points = useMemo(() => {
    const days = 14;
    const honors: number[] = [];
    for (let d = dayIndex - days + 1; d <= dayIndex; d++) {
      honors.push(botSnapshot(worldSeed, bot.id, Math.max(0, d)).honor);
    }
    const min = Math.min(...honors);
    const max = Math.max(...honors);
    const span = Math.max(1, max - min);
    return honors
      .map((h, i) => `${(i / (days - 1)) * 100},${34 - ((h - min) / span) * 28}`)
      .join(' ');
  }, [worldSeed, bot.id, dayIndex]);
  return (
    <svg
      viewBox="0 0 100 38"
      preserveAspectRatio="none"
      className="h-10 w-full"
      role="img"
      aria-label={t('profile.history')}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--honor)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Profile peek (GAME_DESIGN §8.2): any ladder row opens a person — gear,
 * attributes, honor history. All derived per (botId, level band); inspecting
 * twice shows the same kit, and nothing here touches the save's rng streams.
 */
export function BotProfileModal({
  bot,
  rank,
  save,
  nowMs,
  onClose,
  onFight,
}: {
  bot: BotSnapshot;
  rank: number;
  save: GameSave;
  nowMs: number;
  onClose: () => void;
  /** present when this bot is one of today's arena offers */
  onFight?: (() => void) | undefined;
}) {
  const kit = useMemo(() => botCombatant(bot, save.worldSeed), [bot, save.worldSeed]);
  const gear = useMemo(() => botDisplayGear(bot, save.worldSeed), [bot, save.worldSeed]);
  const dayIndex = worldDayIndex(save, nowMs);
  const daysIn = Math.max(0, dayIndex - bot.joinDay);

  return (
    <Modal title={bot.name} onClose={onClose}>
      <div className="flex items-center gap-3">
        <EmblemAvatar emblem={bot.emblem} classId={bot.classId} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-bold text-ink">
              {t(`class.${bot.classId}.name` as I18nKey)}
            </span>
            <span className="rounded-sm bg-panel-inset px-1.5 py-0.5 text-[11px] font-extrabold text-gold">
              {t('common.levelShort', { level: bot.level })}
            </span>
            <span className="text-[11px] font-bold text-ink-faint">
              {bot.guildTag ? `[${bot.guildTag}]` : t('profile.guildless')}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs font-bold text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Icon id="crown" size={13} className="text-gold" /> {t('arena.rank', { rank })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon id="honor" size={13} className="text-honor" /> {fmt(bot.honor)}
            </span>
            <span className="text-ink-faint">
              {daysIn === 0 ? t('profile.joinedToday') : t('profile.joined', { days: daysIn })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-sm bg-panel-inset px-3 py-2">
        <div className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
          {t('profile.history')}
        </div>
        <Sparkline worldSeed={save.worldSeed} bot={bot} dayIndex={dayIndex} />
      </div>

      <h3 className="mt-4 text-[10px] font-bold tracking-wider text-ink-faint uppercase">
        {t('profile.attrs')}
      </h3>
      <div className="mt-1 grid grid-cols-5 gap-1.5">
        {ATTRIBUTE_IDS.map((attr) => (
          <div key={attr} className="rounded-sm bg-panel-inset px-1 py-1.5 text-center">
            <div className="text-[9px] font-extrabold tracking-wider text-ink-faint">
              {t(`attr.${attr}.short` as I18nKey)}
            </div>
            <div className="font-display text-sm font-bold text-ink">{fmt(kit.attrs[attr])}</div>
          </div>
        ))}
      </div>

      <h3 className="mt-4 text-[10px] font-bold tracking-wider text-ink-faint uppercase">
        {t('profile.kit')}
      </h3>
      <div className="mt-1 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-sm bg-panel-inset px-1 py-1.5">
          <div className="text-[9px] font-extrabold tracking-wider text-ink-faint">
            {t('profile.hp')}
          </div>
          <div className="font-display text-sm font-bold text-hp">{fmt(kit.maxHp)}</div>
        </div>
        <div className="rounded-sm bg-panel-inset px-1 py-1.5">
          <div className="text-[9px] font-extrabold tracking-wider text-ink-faint">
            {t('profile.armor')}
          </div>
          <div className="font-display text-sm font-bold text-ink">{fmt(kit.armor)}</div>
        </div>
        <div className="rounded-sm bg-panel-inset px-1 py-1.5">
          <div className="text-[9px] font-extrabold tracking-wider text-ink-faint">
            {t('profile.weapon')}
          </div>
          <div className="font-display text-sm font-bold text-ink">
            {kit.weapon.min}–{kit.weapon.max}
          </div>
        </div>
      </div>

      <h3 className="mt-4 text-[10px] font-bold tracking-wider text-ink-faint uppercase">
        {t('profile.gear')}
      </h3>
      <ul className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {gear.map((item) => (
          <li
            key={item.id}
            className="truncate rounded-sm bg-panel-inset px-2 py-1 text-xs font-semibold"
          >
            <span className={RARITY_TEXT[item.rarity]}>{itemName(item)}</span>{' '}
            <span className="text-[10px] text-ink-faint">
              {t('item.ilvl', { ilvl: item.ilvl })}
            </span>
          </li>
        ))}
      </ul>

      {onFight && (
        <div className="mt-4 flex justify-end">
          <FButton
            onClick={() => {
              onClose();
              onFight();
            }}
          >
            <Icon id="arena" size={16} /> {t('profile.fight')}
          </FButton>
        </div>
      )}
    </Modal>
  );
}
