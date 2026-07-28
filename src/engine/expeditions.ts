/**
 * Expeditions (GAME_DESIGN.md §16, numbers BALANCING §4.6): the choice-driven
 * vigor spend. 25 vigor buys 5 encounters of 3 revealed cards; picks earn
 * Heroism; Heroism sets the final chest tier. Losing a fight never ends a run —
 * it just pays less. Card draws ride the persisted `missions` stream, fights
 * the `combat` stream, chests the `loot` stream: nothing here is fishable.
 */
import { EVENTS, getLocale } from '@/content/expeditions';
import {
  EXPED_CARD_WEIGHTS,
  EXPED_CHEST_GOLD,
  EXPED_CHEST_XP,
  EXPED_FIGHT_GOLD_MULT,
  EXPED_GOLD_CHEST_SET_CHANCE,
  EXPED_TREASURE_GOLD_MULT,
  EXPEDITION_COST,
  EXPEDITION_STEPS,
  EXPEDITIONS_PER_DAY,
  HEROISM_FIGHT_LOSS,
  HEROISM_FIGHT_WIN,
  HEROISM_GOLD,
  HEROISM_MINIBOSS_LOSS,
  HEROISM_MINIBOSS_WIN,
  HEROISM_SILVER,
  HEROISM_TREASURE,
} from './constants';
import { simulateCombat, type Combatant, type CombatResult } from './combat';
import { archetypeCombatant, heroToCombatant } from './combatants';
import { missionGold, missionXp } from './economy';
import { rollDrop, sellPrice } from './items';
import { getStream } from './rng';
import { activeEffect, rollSetPiece } from './sets';
import { SETS } from '@/content/sets';
import type { ExpeditionCard, ExpeditionState, GameSave, ItemInstance } from './types';
import { applyXp, type XpResult } from './xpGain';

export type ChestTier = 'bronze' | 'silver' | 'gold';

export function expeditionLimit(save: GameSave): number {
  return EXPEDITIONS_PER_DAY + (activeEffect(save, 'expedition')?.extraDaily ?? 0);
}

export function expeditionsLeft(save: GameSave): number {
  return Math.max(0, expeditionLimit(save) - save.daily.expeditions);
}

export function canStartExpedition(
  save: GameSave,
): { ok: true } | { ok: false; reason: 'active' | 'limit' | 'vigor' } {
  if (save.activities.expedition) return { ok: false, reason: 'active' };
  if (expeditionsLeft(save) === 0) return { ok: false, reason: 'limit' };
  if (save.daily.vigor < EXPEDITION_COST) return { ok: false, reason: 'vigor' };
  return { ok: true };
}

/** Embark: vigor down, day counter up; Twilight Wanderer walks in with +6. */
export function startExpedition(save: GameSave, localeId: string): ExpeditionState {
  const gate = canStartExpedition(save);
  if (!gate.ok) throw new Error(`Expedition refused: ${gate.reason}`);
  getLocale(localeId); // throws on unknown locale
  save.daily.vigor -= EXPEDITION_COST;
  save.daily.expeditions += 1;
  const state: ExpeditionState = {
    localeId,
    step: 0,
    heroism: activeEffect(save, 'expedition')?.heroism ?? 0,
    cards: null,
  };
  save.activities.expedition = state;
  return state;
}

/** The current encounter's three cards, rolled once and persisted. */
export function ensureCards(save: GameSave): ExpeditionCard[] {
  const exp = save.activities.expedition;
  if (!exp) throw new Error('No expedition in progress');
  if (exp.cards) return exp.cards;
  const rng = getStream(save.rngState, save.worldSeed, 'missions');
  const cards: ExpeditionCard[] = [];
  const usedEvents = new Set<number>();
  for (let i = 0; i < 3; i++) {
    const kind = rng.weighted(EXPED_CARD_WEIGHTS.map(([k, w]) => [k, w] as const));
    if (kind === 'fight') {
      const foe = rng.weighted([
        ['grunt', 40],
        ['swift', 25],
        ['caster', 20],
        ['brute', 15],
      ] as const);
      cards.push({ kind: 'fight', foe });
    } else if (kind === 'treasure') {
      cards.push({ kind: 'treasure' });
    } else {
      let eventIndex = rng.int(0, EVENTS.length - 1);
      while (usedEvents.has(eventIndex)) eventIndex = (eventIndex + 1) % EVENTS.length;
      usedEvents.add(eventIndex);
      cards.push({ kind: 'event', eventIndex });
    }
  }
  // Encounter 3 always offers the locale's mini-boss as its last card (§16).
  if (exp.step === 2) cards[2] = { kind: 'miniboss' };
  exp.cards = cards;
  return cards;
}

export interface ExpeditionChest {
  tier: ChestTier;
  gold: number;
  xp: XpResult;
  item: ItemInstance | null;
  setDrop: boolean;
  autoSoldGold: number;
}

export interface ExpeditionStepOutcome {
  card: ExpeditionCard;
  /** combat log when the card was a fight (playback-ready) */
  result: CombatResult | null;
  foe: Combatant | null;
  heroCombatant: Combatant | null;
  won: boolean | null;
  heroismGained: number;
  gold: number;
  xp: XpResult | null;
  /** the run's final chest — present on the fifth resolution */
  chest: ExpeditionChest | null;
  state: ExpeditionState | null;
}

export function chestTier(heroism: number): ChestTier {
  if (heroism >= HEROISM_GOLD) return 'gold';
  if (heroism >= HEROISM_SILVER) return 'silver';
  return 'bronze';
}

/** Sets whose pieces a Gold chest may hold: at or below the hero's bracket. */
function eligibleSetIds(save: GameSave): string[] {
  const ids = SETS.filter(
    (s) => (s.classId === null || s.classId === save.hero.classId) && s.level <= save.hero.level + 5,
  ).map((s) => s.id);
  return ids.length > 0 ? ids : ['innkeepers-regalia'];
}

function finishExpedition(save: GameSave): ExpeditionChest {
  const exp = save.activities.expedition!;
  const tier = chestTier(exp.heroism);
  const loot = getStream(save.rngState, save.worldSeed, 'loot');
  const gold = Math.round(missionGold(save.hero.level, 10) * EXPED_CHEST_GOLD[tier]);
  let item: ItemInstance | null = null;
  let setDrop = false;
  if (tier === 'gold' && loot.chance(EXPED_GOLD_CHEST_SET_CHANCE)) {
    item = rollSetPiece(save, loot.pick(eligibleSetIds(save)), loot);
    setDrop = true;
  } else {
    item = rollDrop(tier === 'bronze' ? 'mission' : 'chest', save.hero.level, save.hero.classId, loot);
  }
  let autoSoldGold = 0;
  if (save.inventory.backpack.length < save.inventory.capacity) {
    save.inventory.backpack.push(item);
  } else {
    autoSoldGold = sellPrice(item);
  }
  save.hero.gold += gold + autoSoldGold;
  save.stats.goldEarned = (save.stats.goldEarned ?? 0) + gold + autoSoldGold;
  save.stats.expeditions = (save.stats.expeditions ?? 0) + 1;
  const xp = applyXp(save, Math.round(missionXp(save.hero.level, 10) * EXPED_CHEST_XP[tier]));
  save.activities.expedition = null;
  return { tier, gold, xp, item, setDrop, autoSoldGold };
}

/**
 * Resolve one picked card. Events need a `choice`; fights run on the persisted
 * combat stream. Resolving the fifth encounter opens the chest and ends the run.
 */
export function resolveCard(
  save: GameSave,
  cardIndex: number,
  choice?: 'safe' | 'bold',
): ExpeditionStepOutcome {
  const exp = save.activities.expedition;
  if (!exp) throw new Error('No expedition in progress');
  const cards = ensureCards(save);
  const card = cards[cardIndex];
  if (!card) throw new Error(`No card at index ${cardIndex}`);

  let result: CombatResult | null = null;
  let foe: Combatant | null = null;
  let hero: Combatant | null = null;
  let won: boolean | null = null;
  let heroismGained = 0;
  let gold = 0;
  let xp: XpResult | null = null;

  const m10 = missionGold(save.hero.level, 10);
  const rng = getStream(save.rngState, save.worldSeed, 'missions');

  if (card.kind === 'fight' || card.kind === 'miniboss') {
    hero = heroToCombatant(save);
    foe =
      card.kind === 'miniboss'
        ? archetypeCombatant('elite', save.hero.level + 2, {
            id: `miniboss-${getLocale(exp.localeId).minibossSlug}`,
          })
        : archetypeCombatant(card.foe, save.hero.level, { id: `exped-${card.foe}` });
    const combatStream = getStream(save.rngState, save.worldSeed, 'combat');
    result = simulateCombat(hero, foe, combatStream.deriveSeed());
    won = result.winner === 0;
    if (card.kind === 'miniboss') {
      heroismGained = won ? HEROISM_MINIBOSS_WIN : HEROISM_MINIBOSS_LOSS;
      gold = won ? Math.round(m10 * EXPED_FIGHT_GOLD_MULT * 2) : 0;
    } else {
      heroismGained = won ? HEROISM_FIGHT_WIN : HEROISM_FIGHT_LOSS;
      gold = won ? Math.round(m10 * EXPED_FIGHT_GOLD_MULT) : 0;
    }
  } else if (card.kind === 'treasure') {
    heroismGained = HEROISM_TREASURE;
    // ±15% wobble on the pouch — the missions stream keeps it save-scum-proof.
    gold = Math.round(m10 * EXPED_TREASURE_GOLD_MULT * (0.85 + rng.next() * 0.3));
  } else {
    const event = EVENTS[card.eventIndex]!;
    const option = choice === 'bold' ? event.bold : event.safe;
    heroismGained = option.heroism;
    if (option.reward === 'gold') {
      gold = Math.round(m10 * option.amount * (0.85 + rng.next() * 0.3));
    } else if (option.reward === 'xp') {
      xp = applyXp(save, Math.round(missionXp(save.hero.level, 10) * option.amount));
    } else if (option.reward === 'heroism') {
      heroismGained += option.amount;
    }
  }

  exp.heroism += heroismGained;
  if (gold > 0) {
    save.hero.gold += gold;
    save.stats.goldEarned = (save.stats.goldEarned ?? 0) + gold;
  }

  exp.step += 1;
  exp.cards = null;
  let chest: ExpeditionChest | null = null;
  if (exp.step >= EXPEDITION_STEPS) {
    chest = finishExpedition(save);
  }

  return {
    card,
    result,
    foe,
    heroCombatant: hero,
    won,
    heroismGained,
    gold,
    xp,
    chest,
    state: save.activities.expedition,
  };
}

/** Walk away mid-run: no refund, no chest — the tavern hears about it anyway. */
export function abandonExpedition(save: GameSave): void {
  save.activities.expedition = null;
}
