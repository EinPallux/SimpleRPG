import { useEffect, useMemo, useRef, useState } from 'react';
import { getArenaOffers } from '@/engine/arena';
import { ladderWithPlayer, type BotSnapshot, type LadderRow } from '@/engine/botworld';
import { systemClock } from '@/engine/clock';
import { CLASS_IDS } from '@/content/classes';
import type { ClassId } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { BotProfileModal } from '../components/BotProfileModal';
import { EmblemAvatar } from '../components/EmblemAvatar';
import { EmptyState } from '../components/EmptyState';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { fmt } from '../format';

const ROW_H = 46;
const OVERSCAN = 8;

/** Rank 1–3 get metal-tinted rank text; everyone else queues politely. */
function rankTint(rank: number): string {
  if (rank === 1) return 'text-gold-bright';
  if (rank === 2) return 'text-[#c8ccd4]';
  if (rank === 3) return 'text-[#cd8f5a]';
  return 'text-ink-faint';
}

function LadderRowButton({
  row,
  isPlayer,
  playerName,
  playerLevel,
  onOpen,
}: {
  row: LadderRow;
  isPlayer: boolean;
  playerName: string;
  playerLevel: number;
  onOpen: () => void;
}) {
  const bot = row.bot;
  return (
    <button
      onClick={onOpen}
      style={{ height: ROW_H }}
      className={`flex w-full items-center gap-2.5 border-b border-black/30 px-2 text-left transition-colors ${
        isPlayer ? 'bg-gold/15 hover:bg-gold/20' : 'hover:bg-panel-raised'
      }`}
      aria-label={`${t('hall.colRank')} ${row.rank}: ${bot ? bot.name : playerName}`}
    >
      <span className={`w-11 shrink-0 text-right font-display text-sm font-extrabold ${rankTint(row.rank)}`}>
        {row.rank <= 3 && <Icon id="crown" size={12} className="mr-0.5 inline-block align-baseline" />}
        {row.rank}
      </span>
      {bot ? (
        <EmblemAvatar emblem={bot.emblem} classId={bot.classId} size={30} />
      ) : (
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-sm bg-gold/20">
          <Icon id="character" size={18} className="text-gold" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">
          {bot ? bot.name : playerName}
          {isPlayer && (
            <span className="ml-1.5 rounded-sm bg-gold px-1 py-px align-middle text-[9px] font-extrabold text-canvas">
              {t('hall.you')}
            </span>
          )}
        </span>
        {bot?.guildTag && (
          <span className="block truncate text-[10px] font-semibold text-ink-faint">
            [{bot.guildTag}]
          </span>
        )}
      </span>
      {bot && (
        <Icon
          id={bot.classId}
          size={15}
          className="shrink-0 text-ink-faint"
          label={t(`class.${bot.classId}.name` as I18nKey)}
        />
      )}
      <span className="w-10 shrink-0 text-right text-xs font-bold text-ink-muted">
        {t('common.levelShort', { level: bot ? bot.level : playerLevel })}
      </span>
      <span className="w-16 shrink-0 text-right font-display text-sm font-bold text-honor">
        {fmt(row.honor)}
      </span>
    </button>
  );
}

/**
 * The realm ladder (GAME_DESIGN §8.2): 750 bots + you, windowed by hand —
 * fixed row height means jump-to targets are simple arithmetic.
 */
export function HallOfFameScreen() {
  const save = useGame((s) => s.save);
  const setScreen = useGame((s) => s.setScreen);
  const fight = useGame((s) => s.arenaFight);
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState<ClassId | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(520);
  const [peek, setPeek] = useState<{ bot: BotSnapshot; rank: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nowMs = systemClock.now();
  const rows = useMemo(() => (save ? ladderWithPlayer(save, systemClock.now()) : []), [save]);
  // Today's offers, for the profile modal's "fight them" shortcut.
  const offerByBotId = useMemo(() => {
    if (!save) return new Map<number, number>();
    const map = new Map<number, number>();
    getArenaOffers(save, systemClock.now(), { stance: false }).forEach((offer, i) =>
      map.set(offer.bot.id, i),
    );
    return map;
  }, [save]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !classFilter) return rows;
    return rows.filter((row) => {
      const bot = row.bot;
      if (bot === null) {
        const nameHit = !q || (save?.hero.name.toLowerCase().includes(q) ?? false);
        const classHit = !classFilter || save?.hero.classId === classFilter;
        return nameHit && classHit;
      }
      if (classFilter && bot.classId !== classFilter) return false;
      if (!q) return true;
      return (
        bot.name.toLowerCase().includes(q) || (bot.guildTag?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, query, classFilter, save]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewH(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!save) return null;

  const playerIndex = filtered.findIndex((row) => row.bot === null);
  const playerRow = rows.find((row) => row.bot === null)!;

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const count = Math.ceil(viewH / ROW_H) + OVERSCAN * 2;
  const visible = filtered.slice(first, first + count);

  const jumpTo = (index: number) => {
    scrollRef.current?.scrollTo({ top: Math.max(0, index * ROW_H - viewH / 2 + ROW_H / 2) });
  };

  return (
    <div className="flex flex-col gap-3">
      <Panel variant="primary">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">{t('hall.title')}</h1>
            <p className="text-sm text-ink-muted">{t('hall.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink-muted">
              {t('hall.yourStanding', { rank: playerRow.rank, honor: fmt(playerRow.honor) })}
            </span>
            <FButton size="sm" variant="quiet" onClick={() => jumpTo(0)}>
              {t('hall.jumpTop')}
            </FButton>
            <FButton
              size="sm"
              onClick={() => (playerIndex >= 0 ? jumpTo(playerIndex) : undefined)}
              disabled={playerIndex < 0}
            >
              {t('hall.jumpMe')}
            </FButton>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('hall.search')}
            aria-label={t('hall.search')}
            className="min-w-0 flex-1 rounded-sm border border-black/40 bg-panel-inset px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint sm:max-w-xs"
          />
          <div className="flex items-center gap-1" role="group" aria-label={t('hall.colClass')}>
            <button
              onClick={() => setClassFilter(null)}
              aria-pressed={classFilter === null}
              className={`rounded-sm px-2 py-1 text-xs font-extrabold ${
                classFilter === null ? 'bg-panel-inset text-gold' : 'text-ink-faint hover:text-ink'
              }`}
            >
              {t('hall.classAll')}
            </button>
            {CLASS_IDS.map((classId) => (
              <button
                key={classId}
                onClick={() => setClassFilter(classFilter === classId ? null : classId)}
                aria-pressed={classFilter === classId}
                title={t(`class.${classId}.name` as I18nKey)}
                className={`rounded-sm px-2 py-1 ${
                  classFilter === classId
                    ? 'bg-panel-inset text-gold'
                    : 'text-ink-faint hover:text-ink'
                }`}
              >
                <Icon id={classId} size={16} />
              </button>
            ))}
          </div>
          <span className="ml-auto text-[11px] font-semibold text-ink-faint">
            {t('hall.shown', { n: filtered.length, total: rows.length })}
          </span>
        </div>
      </Panel>

      <Panel variant="secondary" className="p-1.5">
        <div
          className="flex items-center gap-2.5 border-b border-black/40 px-2 py-1.5 text-[10px] font-extrabold tracking-wider text-ink-faint uppercase"
          aria-hidden="true"
        >
          <span className="w-11 text-right">{t('hall.colRank')}</span>
          <span className="w-[30px]" />
          <span className="min-w-0 flex-1">{t('hall.colName')}</span>
          <span className="w-10 text-right">{t('hall.colLevel')}</span>
          <span className="w-16 text-right">{t('hall.colHonor')}</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon="hall-of-fame" title={t('hall.noMatch')} body="" />
        ) : (
          <div
            ref={scrollRef}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            className="h-[min(62dvh,640px)] overflow-y-auto"
          >
            <div style={{ height: filtered.length * ROW_H, position: 'relative' }}>
              <div style={{ position: 'absolute', top: first * ROW_H, left: 0, right: 0 }}>
                {visible.map((row) => (
                  <LadderRowButton
                    key={row.bot ? `b${row.bot.id}` : 'you'}
                    row={row}
                    isPlayer={row.bot === null}
                    playerName={save.hero.name}
                    playerLevel={save.hero.level}
                    onOpen={() =>
                      row.bot
                        ? setPeek({ bot: row.bot, rank: row.rank })
                        : setScreen('character')
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Panel>

      {peek && (
        <BotProfileModal
          bot={peek.bot}
          rank={peek.rank}
          save={save}
          nowMs={nowMs}
          onClose={() => setPeek(null)}
          onFight={
            offerByBotId.has(peek.bot.id)
              ? () => {
                  fight(offerByBotId.get(peek.bot.id)!);
                  setPeek(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
