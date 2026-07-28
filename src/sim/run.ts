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
import { fightArena, fightsLeft } from '@/engine/arena';
import { playerRank } from '@/engine/botworld';
import { attrCost, buyAttributePoint } from '@/engine/economy';
import { canEquip, equipItem } from '@/engine/inventoryOps';
import { itemArmor, sellPrice, slotOf, weaponDamage } from '@/engine/items';
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
}

export interface SimResult {
  profile: Profile;
  days: number;
  seed: string;
  finalLevel: number;
  finalGold: number;
  finalAttrs: Record<AttributeId, number>;
  /** Gold-faucet/sink audit (BALANCING.md §6 — asserted in scenarios) */
  goldFrom: { missions: number; patrol: number; selling: number; arena: number };
  goldSpentOnAttrs: number;
  equippedCount: number;
  finalRank: number;
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
}

const POLICIES: Record<Profile, PolicyConfig> = {
  optimal: {
    vigorBudget: Infinity,
    secondWind: true,
    patrolCollections: 1,
    playStartHour: 8,
    arenaFights: 10,
  },
  casual: {
    vigorBudget: 60,
    secondWind: false,
    patrolCollections: 0,
    playStartHour: 18,
    arenaFights: 6,
  },
  'idle-only': {
    vigorBudget: 20,
    secondWind: false,
    patrolCollections: 0,
    playStartHour: 20,
    arenaFights: 0,
  },
};

function bestAffordableIndex(offers: MissionOffer[], vigor: number): number {
  let best = -1;
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i]!;
    if (o.durationMin <= vigor && (best === -1 || o.durationMin > offers[best]!.durationMin)) {
      best = i;
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

/** Equip strictly-better drops before selling the rest (the real player habit). */
function equipUpgrades(save: GameSave): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < save.inventory.backpack.length; i++) {
      const item = save.inventory.backpack[i]!;
      if (!canEquip(save, item)) continue;
      const current = save.inventory.equipped[slotOf(item)];
      if (!current || itemScore(item) > itemScore(current)) {
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
  const goldFrom = { missions: 0, patrol: 0, selling: 0, arena: 0 };
  let goldSpentOnAttrs = 0;

  for (let day = 1; day <= days; day++) {
    const dayStart = START + (day - 1) * 24 * HOUR;
    let now = dayStart + policy.playStartHour * HOUR;

    // Arriving for today's session: bank patrol/resets for everything crossed.
    goldFrom.patrol += applyTimePassage(save, now).patrolGoldBanked;

    if (policy.secondWind && !save.daily.secondWindUsed) claimSecondWind(save);

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
    equippedCount: Object.values(save.inventory.equipped).filter(Boolean).length,
    finalRank: records[records.length - 1]?.rank ?? 751,
    records,
  };
}
