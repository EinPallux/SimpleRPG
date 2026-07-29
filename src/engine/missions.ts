/**
 * Tavern missions — engine reducers (GAME_DESIGN.md §5, BALANCING.md §2.3).
 * UI arrives in M2; the balance simulator drives these directly. All functions
 * mutate the passed save draft and are deterministic given the rng streams.
 */
import { monstersOfZone } from '@/content/bestiary';
import { zonePetChance, zonePetFor } from '@/content/pets';
import { frontierZoneIndex, getZone } from '@/content/zones';
import {
  MISSION_CHEST_CHANCE,
  MISSION_DURATIONS,
  MOUNT_SPEED,
  TAVERN_REROLL_COST_GEMS,
  TREATS_PER_MISSION,
} from './constants';
import { missionGold, missionXp, zoneMultiplier } from './economy';
import { effectiveItemChance, rollDrop, sellPrice, type DropSource } from './items';
import { bump, recordDrop, recordMonster } from './ledger';
import { auraTotal, grantPet, petOwned } from './pets';
import { getStream } from './rng';
import { activeEffect } from './sets';
import { totalAttribute } from './stats';
import type { GameSave, ItemInstance, MissionPayload, TimedActivity } from './types';
import { applyXp, type XpResult } from './xpGain';

export interface MissionOffer {
  zoneIndex: number;
  durationMin: number;
  lucky: boolean;
  xp: number;
  gold: number;
  /** raw flavor roll — mapped onto text pools at render time */
  flavor: number;
}

const LUCKY_CHANCE = 0.05;
const LUCKY_MULT = 2;

/** Roll three offers from the pinned/frontier zone (GAME_DESIGN §5). */
export function generateMissionOffers(save: GameSave): MissionOffer[] {
  const rng = getStream(save.rngState, save.worldSeed, 'missions');
  const frontier = frontierZoneIndex(save.hero.level);
  const zoneIndex = save.progress.zonePinned ?? frontier;
  const zone = getZone(Math.min(zoneIndex, frontier));
  const mult = zoneMultiplier(zone.index, frontier);

  return [0, 1, 2].map(() => {
    const durationMin = rng.pick(MISSION_DURATIONS);
    const lucky = rng.chance(LUCKY_CHANCE);
    const boost = lucky ? LUCKY_MULT : 1;
    return {
      zoneIndex: zone.index,
      durationMin,
      lucky,
      xp: Math.ceil(missionXp(save.hero.level, durationMin) * mult * boost),
      gold: Math.ceil(missionGold(save.hero.level, durationMin) * mult * boost),
      flavor: rng.int(0, 9999),
    };
  });
}

/**
 * The standing board: offers persist in the save until accepted or rerolled —
 * reloading (or toggling the zone pin) never re-rolls them.
 */
export function getTavernOffers(save: GameSave): MissionOffer[] {
  if (!save.activities.tavernOffers) {
    save.activities.tavernOffers = generateMissionOffers(save);
  }
  return save.activities.tavernOffers;
}

export function tavernRerollCost(save: GameSave): number {
  return save.daily.tavernRerollUsed ? TAVERN_REROLL_COST_GEMS : 0;
}

export function canRerollTavern(save: GameSave): boolean {
  return save.hero.gems >= tavernRerollCost(save);
}

/** First reroll of the day is free; afterwards it costs gems (GAME_DESIGN §5). */
export function rerollTavernOffers(save: GameSave): MissionOffer[] {
  const cost = tavernRerollCost(save);
  if (save.hero.gems < cost) throw new Error('Not enough gems to reroll the board');
  if (cost > 0) save.hero.gems -= cost;
  else save.daily.tavernRerollUsed = true;
  save.activities.tavernOffers = generateMissionOffers(save);
  return save.activities.tavernOffers;
}

/** Accept one of the standing offers; the board clears until the next visit. */
export function acceptTavernOffer(save: GameSave, index: number, nowMs: number): void {
  const offers = getTavernOffers(save);
  const offer = offers[index];
  if (!offer) throw new Error(`No tavern offer at index ${index}`);
  startMission(save, offer, nowMs);
  save.activities.tavernOffers = null;
}

/**
 * Mount speed and the pet's `missionSpeed` aura stack MULTIPLICATIVELY, not
 * additively: an Ember Drake (−50%) plus a maxed Fernwyrm (−15%) leaves 42.5%
 * of the clock, never 35%. Additive stacking would let the pair approach a
 * zero-duration mission and quietly break the vigor economy the whole idle
 * loop is metered by (BALANCING §2.2).
 */
export function missionDurationSec(save: GameSave, durationMin: number): number {
  const mount = MOUNT_SPEED[save.progress.mountTier] ?? 0;
  const pet = auraTotal(save, 'missionSpeed');
  return Math.max(1, Math.round(durationMin * 60 * (1 - mount) * (1 - pet)));
}

export function canStartMission(save: GameSave, offer: MissionOffer): boolean {
  return (
    save.daily.vigor >= offer.durationMin &&
    save.activities.mission === null &&
    save.activities.patrol === null &&
    save.activities.expedition === null
  );
}

/** Vigor is spent at start (S&F rule); rewards are locked into the payload. */
export function startMission(save: GameSave, offer: MissionOffer, nowMs: number): void {
  if (!canStartMission(save, offer)) throw new Error('Cannot start mission (vigor/activity)');
  save.daily.vigor -= offer.durationMin;
  bump(save, 'vigorSpent', offer.durationMin);
  const payload: MissionPayload = {
    zoneIndex: offer.zoneIndex,
    durationMin: offer.durationMin,
    lucky: offer.lucky,
    xp: offer.xp,
    gold: offer.gold,
    flavor: offer.flavor,
  };
  save.activities.mission = {
    kind: 'mission',
    startedAt: new Date(nowMs).toISOString(),
    durationSec: missionDurationSec(save, offer.durationMin),
    payload,
  } satisfies TimedActivity<MissionPayload>;
}

export function missionEndsAt(mission: TimedActivity<MissionPayload>): number {
  return Date.parse(mission.startedAt) + mission.durationSec * 1000;
}

export function isMissionComplete(save: GameSave, nowMs: number): boolean {
  const m = save.activities.mission;
  return m !== null && nowMs >= missionEndsAt(m);
}

export interface MissionRewards {
  xp: XpResult;
  gold: number;
  item: ItemInstance | null;
  chest: ItemInstance | null;
  /** drops auto-sold because the backpack was full (gold already included) */
  autoSoldGold: number;
  lucky: boolean;
  zoneIndex: number;
  treats: number;
  /** the zone's pet chain paid off on this run (GAME_DESIGN §11.1) */
  petId: string | null;
}

/** Claim a finished mission: XP, gold, item roll (33%+luck), bonus chest (5%). */
export function claimMission(save: GameSave, nowMs: number): MissionRewards {
  const mission = save.activities.mission;
  if (!mission || nowMs < missionEndsAt(mission)) throw new Error('No finished mission to claim');
  const { payload } = mission;

  const loot = getStream(save.rngState, save.worldSeed, 'loot');
  const luck = totalAttribute(save, 'lck');
  // Innkeeper's Regalia full set: +pp on top of the luck-capped chance (§4.6).
  const setItemPP = (activeEffect(save, 'missionItemPP')?.pp ?? 0) / 100;
  const petItemPP = auraTotal(save, 'itemChancePP') / 100;
  const item = loot.chance(effectiveItemChance(luck, save.hero.level) + setItemPP + petItemPP)
    ? rollDrop('mission' as DropSource, save.hero.level, save.hero.classId, loot)
    : null;
  const chest = loot.chance(MISSION_CHEST_CHANCE)
    ? rollDrop('chest', save.hero.level, save.hero.classId, loot)
    : null;

  save.hero.gold += payload.gold;
  save.stats.missionsCompleted = (save.stats.missionsCompleted ?? 0) + 1;
  save.stats.goldEarned = (save.stats.goldEarned ?? 0) + payload.gold;
  // A mission is a day out in a zone: you meet something, and the Bestiary
  // remembers it (GAME_DESIGN §13 — the codex fills from where you actually go).
  const sighted = monstersOfZone(payload.zoneIndex);
  if (sighted.length > 0) {
    recordMonster(save, loot.pick(sighted).id);
  }
  let autoSoldGold = 0;
  for (const drop of [item, chest]) {
    if (!drop) continue;
    recordDrop(save, drop);
    if (save.inventory.backpack.length < save.inventory.capacity) {
      save.inventory.backpack.push(drop);
    } else {
      // Full backpack: the innkeeper flogs it for you rather than losing it.
      autoSoldGold += sellPrice(drop);
    }
  }
  save.hero.gold += autoSoldGold;

  // Pet Treats trickle in from every mission (§11.1), boosted by a `treatFind`
  // aura — the one aura that compounds, since treats buy aura levels.
  //
  // The base is 1, so the bonus is a FRACTION of a treat and rounding would
  // silently eat it: a maxed Moon Calf pays +18%, and `round(1.18)` is 1 at
  // every pet level. Roll the fraction instead — the aura then pays exactly its
  // advertised value in expectation, and it rolls on the persisted loot stream
  // so it cannot be re-rolled by reloading.
  const treatRate = TREATS_PER_MISSION * (1 + auraTotal(save, 'treatFind'));
  const treats = Math.floor(treatRate) + (loot.chance(treatRate % 1) ? 1 : 0);
  save.hero.treats += treats;

  // The zone's pet chain. Rolled last so the drop stream's earlier draws stay
  // byte-identical to a save that never opens the Menagerie.
  let petId: string | null = null;
  const chain = zonePetFor(payload.zoneIndex);
  if (chain && !petOwned(save, chain.id) && loot.chance(zonePetChance(payload.zoneIndex))) {
    grantPet(save, chain.id);
    petId = chain.id;
  }

  const xp = applyXp(save, payload.xp);
  save.activities.mission = null;

  return {
    xp,
    gold: payload.gold,
    item,
    chest,
    autoSoldGold,
    lucky: payload.lucky,
    zoneIndex: payload.zoneIndex,
    treats,
    petId,
  };
}
