/**
 * The Wishing Well (GAME_DESIGN.md §10, odds BALANCING.md §7, rotation
 * CONTENT_CATALOG.md §7).
 *
 * The ethical-gacha contract expressed as layout: the posted odds table and
 * both pity counters render unconditionally — no tooltip, no expander, no
 * second tap — and they sit ABOVE the toss buttons, so the numbers are on the
 * way in rather than an afterthought. There is no purchase path on this screen
 * because there is none in the game (invariant 1): gems are earned, and the
 * only thing this screen can spend is what the hero already has.
 *
 * Everything rotating here is a pure function of the ISO week (the well's own
 * flavour line included), so two devices on the same Monday see the same well.
 */
import { useState } from 'react';
import { PITY_EPIC_EVERY, PITY_SET_AT, type BannerId } from '@/content/collectibles';
import {
  BANNERS,
  bannerBlurbKey,
  bannerNameKey,
  consumableSplit,
  featuredSetForHero,
  oddsTable,
  petPhaseForWeek,
  wellLineKey,
  type TossOutcomeKind,
} from '@/content/gacha';
import { petNameKey, wellExclusives } from '@/content/pets';
import { getSet } from '@/content/sets';
import { TOSS_TEN_COUNT, WELL_UNLOCK_LEVEL } from '@/engine/constants';
import { canToss, freeTossAvailable, pityRemaining, tossCost, wellUnlocked } from '@/engine/gacha';
import { isoWeekNumber } from '@/engine/time';
import type { GameSave } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { CurrencyChip } from '../components/CurrencyChip';
import { EmptyState } from '../components/EmptyState';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { TossReveal } from '../components/TossReveal';
import { useGameClock } from '../hooks/useGameClock';

/** Row tint — the odds bar's legend, straight off the rarity tokens (§2). */
const ROW_COLOR: Record<TossOutcomeKind | 'frame', string> = {
  consumable: 'var(--ink-faint)',
  frame: 'var(--teal)',
  rare: 'var(--r-rare)',
  epic: 'var(--r-epic)',
  setPiece: 'var(--r-set)',
  petEgg: 'var(--honor)',
  legendary: 'var(--r-legendary)',
};

interface PrintedRow {
  id: TossOutcomeKind | 'frame';
  label: string;
  pct: number;
}

/**
 * The table exactly as it is printed. The cosmetic frame is a sub-roll *inside*
 * the consumable slot (BALANCING §7), so it gets its own row by splitting that
 * slot rather than by adding percentage points: bundle + frame is the slot, the
 * other five rows are the banner's own numbers, and the total is therefore the
 * banner column — 100 — with no arithmetic of ours in between.
 */
function printedOdds(bannerId: BannerId): PrintedRow[] {
  const split = consumableSplit(bannerId);
  const rows: PrintedRow[] = [];
  for (const row of oddsTable(bannerId)) {
    if (row.kind === 'consumable') {
      rows.push({ id: 'consumable', label: t(row.labelKey as I18nKey), pct: split.bundle });
      if (split.frame > 0) {
        rows.push({ id: 'frame', label: t('well.outcome.frame'), pct: split.frame });
      }
    } else {
      rows.push({ id: row.kind, label: t(row.labelKey as I18nKey), pct: row.pct });
    }
  }
  return rows;
}

/** Always on screen (§10). One segment per printed row — the bar fills the
 *  track only because those rows total 100%. */
function OddsPanel({ bannerId }: { bannerId: BannerId }) {
  const rows = printedOdds(bannerId);
  return (
    <Panel variant="inset" title={t('well.odds')}>
      <div
        aria-hidden="true"
        className="mb-3 flex h-3 w-full overflow-hidden rounded-sm border border-black/40 bg-panel-inset"
      >
        {rows.map((row) => (
          <span key={row.id} style={{ width: `${row.pct}%`, background: ROW_COLOR[row.id] }} />
        ))}
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2 text-xs font-semibold text-ink-muted">
            <span
              aria-hidden="true"
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ background: ROW_COLOR[row.id] }}
            />
            <span className="min-w-0">{t('well.oddsRow', { label: row.label, pct: row.pct })}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Also always on screen (§10): how many tosses until each guarantee pays. */
function PityPanel({ save, bannerId }: { save: GameSave; bannerId: BannerId }) {
  const pity = pityRemaining(save, bannerId);
  return (
    <Panel variant="inset" title={t('well.pity')}>
      <div className="flex flex-col gap-3">
        <ProgressBar
          variant="xp"
          value={PITY_EPIC_EVERY - pity.toEpic}
          max={PITY_EPIC_EVERY}
          label={t('well.pityEpic', { n: pity.toEpic })}
        />
        <ProgressBar
          variant="vigor"
          value={PITY_SET_AT - pity.toSet}
          max={PITY_SET_AT}
          label={t('well.pitySet', { n: pity.toSet })}
        />
      </div>
    </Panel>
  );
}

/** The week's rate-up set / focus pet, for the banners that rotate. */
function BannerFocus({
  bannerId,
  save,
  week,
}: {
  bannerId: BannerId;
  save: GameSave;
  week: number;
}) {
  if (bannerId === 'featured') {
    const setName = t(getSet(featuredSetForHero(week, save.hero.level)).nameKey as I18nKey);
    return (
      <div className="frame-secondary--muted panel-fill-inset mt-3 p-3">
        <p className="text-[10px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
          {t('well.featured')}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 font-display text-lg font-bold text-gold-bright">
          <Icon id="star" size={16} className="text-gold" />
          {setName}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{t('well.featuredNote', { set: setName })}</p>
      </div>
    );
  }
  if (bannerId === 'pet') {
    const focus = wellExclusives(petPhaseForWeek(week))[0];
    if (!focus) return null;
    return (
      <div className="frame-secondary--muted panel-fill-inset mt-3 p-3">
        <p className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-gold-bright">
          <Icon id="menagerie" size={16} className="text-gold" />
          {/* petNameKey, not `focus.nameKey` — a PetDef stores the BASE key. */}
          {t('well.petFocus', { pet: t(petNameKey(focus.id) as I18nKey) })}
        </p>
      </div>
    );
  }
  return null;
}

export function WellScreen() {
  const save = useGame((s) => s.save);
  const toss = useGame((s) => s.wellToss);
  const outcome = useGame((s) => s.tossOutcome);
  const closeOutcome = useGame((s) => s.closeTossOutcome);
  const now = useGameClock(60_000);
  const [bannerId, setBannerId] = useState<BannerId>('standard');

  if (!save) return null;

  if (!wellUnlocked(save)) {
    return (
      <Panel variant="special">
        <EmptyState
          icon="lock"
          title={t('well.title')}
          body={t('well.locked', { level: WELL_UNLOCK_LEVEL })}
        />
      </Panel>
    );
  }

  const week = isoWeekNumber(now);
  const free = freeTossAvailable(save, bannerId);
  const costOne = tossCost(save, bannerId, 1);
  const costTen = tossCost(save, bannerId, TOSS_TEN_COUNT);
  const canOne = canToss(save, bannerId, 1);
  const canTen = canToss(save, bannerId, TOSS_TEN_COUNT);

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="special">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="inline-flex items-center gap-2 font-display text-2xl font-bold text-gold-bright">
              <Icon id="well" size={24} className="text-gold" />
              {t('well.title')}
            </h1>
            <p className="text-sm text-ink-muted">{t('well.subtitle')}</p>
          </div>
          <CurrencyChip kind="gems" value={save.hero.gems} />
        </div>
        <p className="mt-3 text-sm text-ink italic">“{t(wellLineKey(week) as I18nKey)}”</p>
      </Panel>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('well.banner')}>
        {BANNERS.map((banner) => (
          <FButton
            key={banner.id}
            size="sm"
            variant={bannerId === banner.id ? 'primary' : 'quiet'}
            aria-pressed={bannerId === banner.id}
            onClick={() => setBannerId(banner.id)}
          >
            {t(bannerNameKey(banner.id) as I18nKey)}
          </FButton>
        ))}
      </div>

      <Panel variant="secondary" title={t(bannerNameKey(bannerId) as I18nKey)}>
        <p className="text-sm leading-relaxed text-ink-muted">
          {t(bannerBlurbKey(bannerId) as I18nKey)}
        </p>
        <BannerFocus bannerId={bannerId} save={save} week={week} />
      </Panel>

      {/* Posted before the bucket, not after it. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <OddsPanel bannerId={bannerId} />
        <PityPanel save={save} bannerId={bannerId} />
      </div>

      <Panel variant="secondary">
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <FButton size="lg" disabled={!canOne} onClick={() => toss(bannerId, 1)}>
              <Icon id="gem" size={18} />
              {free ? t('well.tossFree') : t('well.toss', { cost: costOne })}
            </FButton>
            <FButton
              size="lg"
              variant="gem"
              disabled={!canTen}
              onClick={() => toss(bannerId, TOSS_TEN_COUNT)}
            >
              <Icon id="gem" size={18} />
              {t('well.tossTen', { cost: costTen })}
            </FButton>
          </div>
          {free && <p className="text-xs font-bold text-gold">{t('well.freeToday')}</p>}
          {(!canOne || !canTen) && (
            <p className="text-xs font-semibold text-ink-faint">{t('well.noGems')}</p>
          )}
        </div>
      </Panel>

      {outcome && (
        <TossReveal bannerId={outcome.bannerId} results={outcome.results} onClose={closeOutcome} />
      )}
    </div>
  );
}
