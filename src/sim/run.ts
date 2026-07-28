/**
 * The balance simulator (BALANCING.md §9): drives the REAL engine reducers
 * through simulated days and reports progression. The §8.2 contract scenarios
 * in `scenarios.test.ts` are CI-enforced product requirements.
 *
 * M1 covers the systems that exist: missions, patrol, vigor, attribute buying,
 * loot→sell. Arena (M4), dungeons/expeditions (M5) and quests/gems (M6) extend
 * the policies in their milestones — bounds already reserve headroom for them.
 */
import { ATTRIBUTE_IDS, type AttributeId, type GameSave } from '@/engine/types';
import { attrCost, buyAttributePoint } from '@/engine/economy';
import { sellPrice } from '@/engine/items';
import {
  claimMission,
  generateMissionOffers,
  missionEndsAt,
  startMission,
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
}

export interface SimResult {
  profile: Profile;
  days: number;
  seed: string;
  finalLevel: number;
  finalGold: number;
  finalAttrs: Record<AttributeId, number>;
  records: DayRecord[];
}

const HOUR = 3_600_000;
const START = new Date(2026, 6, 28, 0, 0).getTime(); // deterministic local anchor

interface PolicyConfig {
  vigorBudget: number; // vigor spent per day (before second wind)
  secondWind: boolean;
  patrolCollections: number; // extra same-day collections (0 = midnight bank only)
  playStartHour: number;
}

const POLICIES: Record<Profile, PolicyConfig> = {
  optimal: { vigorBudget: Infinity, secondWind: true, patrolCollections: 1, playStartHour: 8 },
  casual: { vigorBudget: 60, secondWind: false, patrolCollections: 0, playStartHour: 18 },
  'idle-only': { vigorBudget: 20, secondWind: false, patrolCollections: 0, playStartHour: 20 },
};

function bestAffordableOffer(offers: MissionOffer[], vigor: number): MissionOffer | null {
  const affordable = offers.filter((o) => o.durationMin <= vigor);
  if (affordable.length === 0) return null;
  return affordable.reduce((best, o) => (o.durationMin > best.durationMin ? o : best));
}

function sellBackpack(save: GameSave): number {
  let gold = 0;
  for (const item of save.inventory.backpack) gold += sellPrice(item);
  save.hero.gold += gold;
  save.inventory.backpack = [];
  return gold;
}

/** Spread gold across attributes, always buying the cheapest next point. */
function buyAttributes(save: GameSave): void {
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
    if (!cheapest || save.hero.gold < cheapestCost) return;
    buyAttributePoint(save, cheapest);
  }
}

export function simulateDays(profile: Profile, days: number, seed = 'sim-seed'): SimResult {
  const policy = POLICIES[profile];
  const save = createNewSave(
    { name: 'Simmy', classId: 'scout', emblem: deriveEmblem('Simmy', 'scout'), worldSeed: seed },
    START + policy.playStartHour * HOUR,
  );
  const records: DayRecord[] = [];

  for (let day = 1; day <= days; day++) {
    const dayStart = START + (day - 1) * 24 * HOUR;
    let now = dayStart + policy.playStartHour * HOUR;

    // Arriving for today's session: bank patrol/resets for everything crossed.
    applyTimePassage(save, now);

    if (policy.secondWind && !save.daily.secondWindUsed) claimSecondWind(save);

    // Mission grind until the day's vigor budget (or the tank) runs dry.
    let spent = 0;
    const missionsBefore = save.stats.missionsCompleted ?? 0;
    while (save.daily.vigor >= 5 && spent < policy.vigorBudget) {
      const offer = bestAffordableOffer(
        generateMissionOffers(save),
        Math.min(save.daily.vigor, policy.vigorBudget - spent),
      );
      if (!offer) break;
      startMission(save, offer, now);
      now = missionEndsAt(save.activities.mission!);
      claimMission(save, now);
      spent += offer.durationMin;
    }

    sellBackpack(save);
    buyAttributes(save);

    // Evening: the exhausted hero walks the walls until midnight.
    if (canStartPatrol(save)) {
      startPatrol(save, now);
      for (let c = 0; c < policy.patrolCollections; c++) {
        now = Math.min(now + 8 * HOUR, dayStart + 24 * HOUR - 60_000);
        collectPatrol(save, now);
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
    });
  }

  return {
    profile,
    days,
    seed,
    finalLevel: save.hero.level,
    finalGold: save.hero.gold,
    finalAttrs: { ...save.hero.attrsBought },
    records,
  };
}
