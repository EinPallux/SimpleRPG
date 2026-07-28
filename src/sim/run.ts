/**
 * The balance simulator (BALANCING.md §9): drives the REAL engine reducers
 * through simulated days and reports progression. The §8.2 contract scenarios
 * in `scenarios.test.ts` are CI-enforced product requirements.
 *
 * M1 covers the systems that exist: missions, patrol, vigor, attribute buying,
 * loot→sell. Arena (M4), dungeons/expeditions (M5) and quests/gems (M6) extend
 * the policies in their milestones — bounds already reserve headroom for them.
 */
import { ATTRIBUTE_IDS, type AttributeId, type GameSave, type ItemInstance } from '@/engine/types';
import { DUNGEONS } from '@/content/dungeons';
import { LOCALES } from '@/content/expeditions';
import { fightArena, fightsLeft } from '@/engine/arena';
import { playerRank } from '@/engine/botworld';
import { attemptFloor, canAttemptFloor } from '@/engine/dungeons';
import { attrCost, buyAttributePoint } from '@/engine/economy';
import {
  canStartExpedition,
  ensureCards,
  resolveCard,
  startExpedition,
} from '@/engine/expeditions';
import { canEquip, equipItem } from '@/engine/inventoryOps';
import { itemArmor, sellPrice, slotOf, weaponDamage } from '@/engine/items';
import { canSpinWheel, spinWheel } from '@/engine/wheel';
import {
  acceptTavernOffer,
  claimMission,
  getTavernOffers,
  missionEndsAt,
  rerollTavernOffers,
  tavernRerollCost,
  type MissionOffer,
} from '@/engine/missions';
import { createNewSave, deriveEmblem } from '@/engine/newSave';
import { canStartPatrol, collectPatrol, startPatrol } from '@/engine/patrol';
import { applyTimePassage } from '@/engine/timePassage';
import { claimSecondWind } from '@/engine/vigor';

export type Profile = 'optimal' | 'casual' | 'idle-only';

export interface DayRecord {
  day: number;
  level: number;
  xpPct: number;
  gold: number;
  attrsTotal: number;
  missions: number;
  patrolTicks: number;
  honor: number;
  rank: number;
  /** total dungeon floors cleared across all wings (0..50) */
  dungeonFloors: number;
}

export interface FloorClear {
  dungeonId: string;
  floor: number;
  day: number;
}

export interface SimResult {
  profile: Profile;
  days: number;
  seed: string;
  finalLevel: number;
  finalGold: number;
  finalAttrs: Record<AttributeId, number>;
  /** Gold-faucet/sink audit (BALANCING.md §6 — asserted in scenarios) */
  goldFrom: {
    missions: number;
    patrol: number;
    selling: number;
    arena: number;
    expeditions: number;
    dungeons: number;
    wheel: number;
  };
  goldSpentOnAttrs: number;
  goldSpentOnWheel: number;
  equippedCount: number;
  finalRank: number;
  /** every dungeon floor beaten, with the day it fell (dungeon-walls scenario) */
  floorClears: FloorClear[];
  records: DayRecord[];
}

const HOUR = 3_600_000;
const START = new Date(2026, 6, 28, 0, 0).getTime(); // deterministic local anchor

interface PolicyConfig {
  vigorBudget: number; // vigor spent per day (before second wind)
  secondWind: boolean;
  patrolCollections: number; // extra same-day collections (0 = midnight bank only)
  playStartHour: number;
  arenaFights: number; // rewarded bouts attempted per day (UI unlocks at L5)
  expeditions: number; // embarkations attempted (L8+, 25 vigor each)
  dungeonSessions: number; // daily visits to the walls (attempts are free, hourly)
  wheelSpins: number; // spins attempted (first free, then rising gold)
  boldEvents: boolean; // expedition events: bold vs safe picks
}

const POLICIES: Record<Profile, PolicyConfig> = {
  optimal: {
    vigorBudget: Infinity,
    secondWind: true,
    patrolCollections: 1,
    playStartHour: 8,
    arenaFights: 10,
    expeditions: 3, // the limit clamps to 2 until Twilight Wanderer completes
    dungeonSessions: 3,
    wheelSpins: 5,
    boldEvents: true,
  },
  casual: {
    vigorBudget: 60,
    secondWind: false,
    patrolCollections: 0,
    playStartHour: 18,
    arenaFights: 6,
    expeditions: 1,
    dungeonSessions: 1,
    wheelSpins: 2,
    boldEvents: false,
  },
  'idle-only': {
    vigorBudget: 20,
    secondWind: false,
    patrolCollections: 0,
    playStartHour: 20,
    arenaFights: 0,
    expeditions: 0,
    dungeonSessions: 0,
    wheelSpins: 0,
    boldEvents: false,
  },
};

/** Optimal players pick by value per vigor (xp+gold), not by duration. */
function bestAffordableIndex(offers: MissionOffer[], vigor: number): number {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i]!;
    if (o.durationMin > vigor) continue;
    const score = (o.xp + o.gold) / o.durationMin;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

function sellBackpack(save: GameSave): number {
  let gold = 0;
  for (const item of save.inventory.backpack) gold += sellPrice(item);
  save.hero.gold += gold;
  save.inventory.backpack = [];
  return gold;
}

/** Crude power score: weapon damage, armor, or line total (jewelry). */
function itemScore(item: ItemInstance): number {
  const slot = slotOf(item);
  if (slot === 'weapon' || slot === 'offhand') {
    const d = weaponDamage(item);
    return (d.min + d.max) / 2 + itemArmor(item);
  }
  const armor = itemArmor(item);
  if (armor > 0) return armor;
  return item.lines.reduce((sum, l) => sum + l.value, 0) * 3;
}

/** Set pieces carry bonus potential beyond raw stats — nudge the heuristic. */
function scoreWithSetBias(item: ItemInstance, raw: number): number {
  return item.rarity === 'set' ? raw * 1.2 : raw;
}

/** Equip strictly-better drops before selling the rest (the real player habit). */
function equipUpgrades(save: GameSave): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < save.inventory.backpack.length; i++) {
      const item = save.inventory.backpack[i]!;
      if (!canEquip(save, item)) continue;
      const current = save.inventory.equipped[slotOf(item)];
      if (
        !current ||
        scoreWithSetBias(item, itemScore(item)) > scoreWithSetBias(current, itemScore(current))
      ) {
        equipItem(save, i);
        i = -1; // indices shifted; restart the scan
      }
    }
  }
}

/** Spread gold across attributes, always buying the cheapest next point. */
function buyAttributes(save: GameSave): number {
  let spent = 0;
  for (;;) {
    let cheapest: AttributeId | null = null;
    let cheapestCost = Infinity;
    for (const attr of ATTRIBUTE_IDS) {
      const cost = attrCost(save.hero.attrsBought[attr] + 1);
      if (cost < cheapestCost) {
        cheapest = attr;
        cheapestCost = cost;
      }
    }
    if (!cheapest || save.hero.gold < cheapestCost) return spent;
    spent += buyAttributePoint(save, cheapest);
  }
}

export function simulateDays(profile: Profile, days: number, seed = 'sim-seed'): SimResult {
  const policy = POLICIES[profile];
  const save = createNewSave(
    { name: 'Simmy', classId: 'scout', emblem: deriveEmblem('Simmy', 'scout'), worldSeed: seed },
    START + policy.playStartHour * HOUR,
  );
  const records: DayRecord[] = [];
  const goldFrom = {
    missions: 0,
    patrol: 0,
    selling: 0,
    arena: 0,
    expeditions: 0,
    dungeons: 0,
    wheel: 0,
  };
  let goldSpentOnAttrs = 0;
  let goldSpentOnWheel = 0;
  const floorClears: FloorClear[] = [];

  for (let day = 1; day <= days; day++) {
    const dayStart = START + (day - 1) * 24 * HOUR;
    let now = dayStart + policy.playStartHour * HOUR;

    // Arriving for today's session: bank patrol/resets for everything crossed.
    goldFrom.patrol += applyTimePassage(save, now).patrolGoldBanked;

    if (policy.secondWind && !save.daily.secondWindUsed) claimSecondWind(save);

    // Expeditions first (L8+): 12.5% better per vigor than missions, so the
    // optimizer spends this budget before the tavern board. Picks chase
    // heroism — mini-boss, then fights, then treasure; events by nerve.
    if (save.hero.level >= 8) {
      for (let e = 0; e < policy.expeditions && canStartExpedition(save).ok; e++) {
        startExpedition(save, LOCALES[(day + e) % LOCALES.length]!.id);
        while (save.activities.expedition) {
          const cards = ensureCards(save);
          let pick = cards.findIndex((c) => c.kind === 'miniboss');
          if (pick === -1) pick = cards.findIndex((c) => c.kind === 'fight');
          if (pick === -1) pick = cards.findIndex((c) => c.kind === 'treasure');
          if (pick === -1) pick = 0;
          const out = resolveCard(save, pick, policy.boldEvents ? 'bold' : 'safe');
          goldFrom.expeditions += out.gold + (out.chest?.gold ?? 0) + (out.chest?.autoSoldGold ?? 0);
          now += 4 * 60_000;
        }
      }
    }

    // Mission grind through the persisted tavern board (the real player path).
    let spent = 0;
    const missionsBefore = save.stats.missionsCompleted ?? 0;
    while (save.daily.vigor >= 5 && spent < policy.vigorBudget) {
      const budget = Math.min(save.daily.vigor, policy.vigorBudget - spent);
      let idx = bestAffordableIndex(getTavernOffers(save), budget);
      if (idx === -1 && tavernRerollCost(save) === 0) {
        // Free daily reroll when the board offers nothing affordable.
        idx = bestAffordableIndex(rerollTavernOffers(save), budget);
      }
      if (idx === -1) break;
      const duration = getTavernOffers(save)[idx]!.durationMin;
      acceptTavernOffer(save, idx, now);
      now = missionEndsAt(save.activities.mission!);
      goldFrom.missions += claimMission(save, now).gold;
      spent += duration;
    }

    // Arena bouts (cooldowns interleave with the mission clock; L5 unlock).
    // Optimal fights UP (offer 2): honor gap-close is where the climb lives
    // (BALANCING §4.5); losses are cheap next to the closed gap.
    if (save.hero.level >= 5) {
      const offerIdx = profile === 'optimal' ? 2 : 0;
      for (let f = 0; f < policy.arenaFights && fightsLeft(save) > 0; f++) {
        const outcome = fightArena(save, offerIdx, now);
        goldFrom.arena += outcome.gold;
        now += 10.5 * 60_000;
      }
    }

    // Dungeon walls: free hourly attempts across up-to-N daily sessions.
    for (let session = 0; session < policy.dungeonSessions; session++) {
      const sessionTime = now + session * 2 * HOUR;
      for (const dungeon of DUNGEONS) {
        if (!canAttemptFloor(save, dungeon.id, sessionTime).ok) continue;
        const out = attemptFloor(save, dungeon.id, sessionTime);
        goldFrom.dungeons += out.gold + out.autoSoldGold;
        if (out.won) floorClears.push({ dungeonId: dungeon.id, floor: out.floor, day });
      }
    }

    // The Wheel (L5): a net-negative gold sink that pays in items, gems, treats.
    if (save.hero.level >= 5) {
      for (let w = 0; w < policy.wheelSpins && canSpinWheel(save); w++) {
        const out = spinWheel(save);
        goldFrom.wheel += out.gold + out.autoSoldGold;
        goldSpentOnWheel += out.cost;
      }
    }

    equipUpgrades(save);
    goldFrom.selling += sellBackpack(save);
    goldSpentOnAttrs += buyAttributes(save);

    // Evening: the exhausted hero walks the walls until midnight.
    if (canStartPatrol(save)) {
      startPatrol(save, now);
      for (let c = 0; c < policy.patrolCollections; c++) {
        now = Math.min(now + 8 * HOUR, dayStart + 24 * HOUR - 60_000);
        goldFrom.patrol += collectPatrol(save, now).gold;
      }
      // Remaining ticks bank automatically at the midnight crossing.
    }

    records.push({
      day,
      level: save.hero.level,
      xpPct: save.hero.xp,
      gold: save.hero.gold,
      attrsTotal: ATTRIBUTE_IDS.reduce((sum, a) => sum + save.hero.attrsBought[a], 0),
      missions: (save.stats.missionsCompleted ?? 0) - missionsBefore,
      patrolTicks: save.stats.patrolTicks ?? 0,
      honor: save.hero.honor,
      rank: playerRank(save, now),
      dungeonFloors: Object.values(save.progress.dungeonFloors).reduce((sum, f) => sum + f, 0),
    });
  }

  return {
    profile,
    days,
    seed,
    finalLevel: save.hero.level,
    finalGold: save.hero.gold,
    finalAttrs: { ...save.hero.attrsBought },
    goldFrom,
    goldSpentOnAttrs,
    goldSpentOnWheel,
    equippedCount: Object.values(save.inventory.equipped).filter(Boolean).length,
    finalRank: records[records.length - 1]?.rank ?? 751,
    floorClears,
    records,
  };
}
