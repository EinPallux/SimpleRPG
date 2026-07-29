import { useRef, useState, type KeyboardEvent } from 'react';
import { achievementNameKey } from '@/content/achievements';
import {
  PET_COLLECTION_CAP,
  PET_MAX_LEVEL,
  type PetAura,
  type PetDef,
  type PetFamily,
  type PetSource,
} from '@/content/collectibles';
import { getDungeon } from '@/content/dungeons';
import {
  getPet,
  PET_FAMILIES,
  petAuras,
  petBlurbKey,
  petFamilyKey,
  petNameKey,
  petsOfFamily,
} from '@/content/pets';
import { getZone } from '@/content/zones';
import { MENAGERIE_UNLOCK_LEVEL } from '@/engine/constants';
import {
  activeAuras,
  auraValueAt,
  canFeedPet,
  collectionBonus,
  ownedPets,
  petOwned,
  petState,
  TOTAL_PETS,
  treatsToNextLevel,
} from '@/engine/pets';
import type { GameSave } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { EmptyState } from '../components/EmptyState';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { fmt } from '../format';
import { RARITY_TEXT } from '../rarity';

/** Auras read with one decimal — enough to see a feed land, never a wall of digits. */
function oneDecimal(value: number): string {
  return value.toFixed(1);
}

/**
 * One aura line as copy. Percent auras carry fractions (0.05 → "+5.0%");
 * `evadePP` / `itemChancePP` are already percentage POINTS and render as-is
 * (collectibles.ts).
 */
function auraLine(aura: PetAura, value: number): string {
  if (aura.kind === 'evadePP' || aura.kind === 'itemChancePP') {
    return t(`aura.${aura.kind}` as I18nKey, { v: oneDecimal(value) });
  }
  if (aura.kind === 'attrPct') {
    const v = oneDecimal(value * 100);
    return aura.attr === 'all'
      ? t('aura.attrPctAll', { v })
      : t('aura.attrPct', { v, attr: t(`attr.${aura.attr}.name` as I18nKey) });
  }
  return t(`aura.${aura.kind}` as I18nKey, { v: oneDecimal(value * 100) });
}

/** Where an undiscovered pet is hiding — the only thing a silhouette gives away. */
function sourceHint(source: PetSource): string {
  switch (source.kind) {
    case 'story':
      return t('menagerie.source.story', { chapter: source.chapter });
    case 'zone':
      return t('menagerie.source.zone', {
        zone: t(getZone(source.zoneIndex).nameKey as I18nKey),
      });
    case 'dungeon':
      return t('menagerie.source.dungeon', {
        dungeon: t(getDungeon(source.dungeonId).nameKey as I18nKey),
      });
    case 'achievement':
      return t('menagerie.source.achievement', {
        achievement: t(achievementNameKey(source.achievementId) as I18nKey),
      });
    case 'well':
      return t('menagerie.source.well');
    case 'wheel':
      return t('menagerie.source.wheel');
  }
}

function AuraList({ pet, level }: { pet: PetDef; level: number }) {
  return (
    <ul className="space-y-0.5">
      {petAuras(pet).map((aura, i) => (
        <li key={i} className="flex items-baseline gap-1.5 text-[11px] leading-relaxed">
          <span className="shrink-0 text-[9px] font-extrabold tracking-wider text-ink-faint uppercase">
            {i === 0 ? t('menagerie.major') : t('menagerie.minor')}
          </span>
          <span className="font-semibold text-teal">
            {auraLine(aura, auraValueAt(aura, level))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PetCard({ save, pet }: { save: GameSave; pet: PetDef }) {
  const equip = useGame((s) => s.petEquip);
  const feed = useGame((s) => s.petFeed);
  const feedMax = useGame((s) => s.petFeedMax);
  const { owned, level } = petState(save, pet.id);
  const rarityLabel = t(`item.rarity.${pet.rarity}` as I18nKey);

  if (!owned) {
    return (
      <div
        className="frame-slot panel-fill-inset flex flex-col gap-2 p-3"
        style={{ ['--frame-w' as string]: '10px' }}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-ink-faint">
            {t('menagerie.undiscovered')}
          </h3>
          <span className={`shrink-0 text-[10px] font-bold opacity-60 ${RARITY_TEXT[pet.rarity]}`}>
            {rarityLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Icon id="menagerie" size={28} className="shrink-0 text-ink-faint opacity-40" />
          <p className="text-[11px] leading-relaxed text-ink-faint italic">
            {sourceHint(pet.source)}
          </p>
        </div>
      </div>
    );
  }

  const equipped = save.progress.equippedPet === pet.id;
  const maxed = level >= PET_MAX_LEVEL;
  const cost = treatsToNextLevel(pet.id, level);
  const feedable = canFeedPet(save, pet.id);
  const missing = Math.max(0, cost - save.hero.treats);

  return (
    <div
      className={`${equipped ? 'frame-slot--gold' : `frame-slot--${pet.rarity}`} panel-fill flex flex-col gap-2 p-3`}
      style={{ ['--frame-w' as string]: '10px' }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={`font-display text-sm font-bold ${RARITY_TEXT[pet.rarity]}`}>
          {t(petNameKey(pet.id) as I18nKey)}
        </h3>
        {equipped && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-panel-inset px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-gold uppercase">
            <Icon id="star" size={10} /> {t('menagerie.equipped')}
          </span>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-ink-muted italic">
        {t(petBlurbKey(pet.id) as I18nKey)}
      </p>

      <div className="flex items-baseline justify-between gap-2 text-[10px] font-bold">
        <span className={RARITY_TEXT[pet.rarity]}>{rarityLabel}</span>
        <span className="text-ink-faint">
          {t('menagerie.petLevel', { level, max: PET_MAX_LEVEL })}
        </span>
      </div>

      <ProgressBar
        variant={maxed ? 'xp' : 'vigor'}
        value={maxed ? 1 : Math.min(save.hero.treats, cost)}
        max={maxed ? 1 : cost}
        className="h-2.5"
        label={
          maxed
            ? t('menagerie.maxed')
            : t('menagerie.treats', {
                n: `${fmt(Math.min(save.hero.treats, cost))} / ${fmt(cost)}`,
              })
        }
      />

      <AuraList pet={pet} level={level} />

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <FButton size="sm" disabled={!feedable} onClick={() => feed(pet.id)}>
          <Icon id="treats" size={12} />
          {maxed
            ? t('menagerie.maxed')
            : feedable
              ? t('menagerie.feed', { cost: fmt(cost) })
              : t('menagerie.needTreats', { n: fmt(missing) })}
        </FButton>
        <FButton size="sm" variant="quiet" disabled={!feedable} onClick={() => feedMax(pet.id)}>
          {t('menagerie.feedMax')}
        </FButton>
        <FButton
          size="sm"
          variant={equipped ? 'quiet' : 'primary'}
          className="ml-auto"
          onClick={() => equip(equipped ? null : pet.id)}
        >
          {equipped ? t('menagerie.unequip') : t('menagerie.equip')}
        </FButton>
      </div>
    </div>
  );
}

export function MenagerieScreen() {
  const save = useGame((s) => s.save);
  const [family, setFamily] = useState<PetFamily>('beast');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Loading: the shell mounts screens before the slot finishes hydrating.
  if (!save) return null;

  if (save.hero.level < MENAGERIE_UNLOCK_LEVEL) {
    return (
      <Panel variant="secondary">
        <EmptyState
          icon="lock"
          title={t('menagerie.title')}
          body={t('menagerie.locked', { level: MENAGERIE_UNLOCK_LEVEL })}
        />
      </Panel>
    );
  }

  const owned = ownedPets(save);
  const bonus = collectionBonus(save);
  const capped = bonus >= PET_COLLECTION_CAP;
  const equippedId = save.progress.equippedPet;
  const equipped = equippedId !== null && petOwned(save, equippedId) ? getPet(equippedId) : null;

  // Arrow keys walk the tab strip; Home/End jump to its ends (UI_DESIGN §8).
  const onTabKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = PET_FAMILIES.length - 1;
    let next: number;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    setFamily(PET_FAMILIES[next]!);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">
              {t('menagerie.title')}
            </h1>
            <p className="text-sm text-ink-muted">{t('menagerie.subtitle')}</p>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-panel-inset/70 px-2 py-1">
              <Icon id="treats" size={16} className="text-ink" />
              <span className="text-sm font-bold text-ink">
                {t('menagerie.treats', { n: fmt(save.hero.treats) })}
              </span>
            </span>
            <span className="text-[11px] font-bold text-ink-faint">
              {t('menagerie.owned', { n: owned.length, total: TOTAL_PETS })}
            </span>
            <span className="text-[11px] font-bold text-teal">
              {capped
                ? t('menagerie.collectionCapped', { pct: oneDecimal(bonus * 100) })
                : t('menagerie.collection', { pct: oneDecimal(bonus * 100) })}
            </span>
          </div>
        </div>
      </Panel>

      {equipped && (
        <Panel
          variant="secondary"
          title={t(petNameKey(equipped.id) as I18nKey)}
          headerRight={
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wide text-gold uppercase">
              <Icon id="star" size={11} /> {t('menagerie.equipped')}
            </span>
          }
        >
          <ul className="space-y-0.5">
            {activeAuras(save).map(({ aura, value }, i) => (
              <li key={i} className="flex items-baseline gap-1.5 text-xs leading-relaxed">
                <span className="shrink-0 text-[9px] font-extrabold tracking-wider text-ink-faint uppercase">
                  {i === 0 ? t('menagerie.major') : t('menagerie.minor')}
                </span>
                <span className="font-bold text-teal">{auraLine(aura, value)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {owned.length === 0 && (
        <Panel variant="secondary">
          <EmptyState icon="menagerie" title={t('menagerie.title')} body={t('menagerie.empty')} />
        </Panel>
      )}

      <div role="tablist" aria-label={t('menagerie.title')} className="flex flex-wrap gap-1.5">
        {PET_FAMILIES.map((id, index) => (
          <button
            key={id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            role="tab"
            id={`menagerie-tab-${id}`}
            aria-selected={family === id}
            aria-controls="menagerie-family-panel"
            tabIndex={family === id ? 0 : -1}
            onClick={() => setFamily(id)}
            onKeyDown={(event) => onTabKeys(event, index)}
            className={`rounded-sm px-3 py-1.5 text-xs font-extrabold transition-colors ${
              family === id ? 'bg-panel-inset text-gold' : 'text-ink-faint hover:text-ink'
            }`}
          >
            {t(petFamilyKey(id) as I18nKey)}
          </button>
        ))}
      </div>

      <div
        id="menagerie-family-panel"
        role="tabpanel"
        aria-labelledby={`menagerie-tab-${family}`}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {petsOfFamily(family).map((pet) => (
          <PetCard key={pet.id} save={save} pet={pet} />
        ))}
      </div>
    </div>
  );
}
