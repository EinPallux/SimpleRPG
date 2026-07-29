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
import type { Cadence } from '@/content/meta';
import { DUNGEONS } from '@/content/dungeons';
import { LOCALES } from '@/content/expeditions';
import { frontierZoneIndex } from '@/content/zones';
import { claimAllAchievements } from '@/engine/achievements';
import { canClaimCalendar, claimCalendarDay } from '@/engine/calendar';
import {
  ALE_COST_GEMS,
  QUESTS_UNLOCK_LEVEL,
  TOSS_TEN_COUNT,
  WELL_UNLOCK_LEVEL,
} from '@/engine/constants';
import {
  canClaimActivityChest,
  canClaimQuest,
  claimActivityChest,
  claimQuest,
  ensureQuestBoard,
} from '@/engine/quests';
import { claimableChapters, claimStep } from '@/engine/story';
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
import { classFitness, equipItem } from '@/engine/inventoryOps';
import { getSet } from '@/content/sets';
import { itemArmor, sellPrice, slotOf, weaponDamage } from '@/engine/items';
import { canSpinWheel, spinWheel } from '@/engine/wheel';
import { canToss, freeTossAvailable, toss, tossCost, type TossResult } from '@/engine/gacha';
import { activeMountTier, buyMount, canBuyMount, mountDaysLeft, mountPrice } from '@/engine/mounts';
import { canFeedPet, equipPet, feedPetMax, ownedPets, petState } from '@/engine/pets';
import { isoWeekNumber } from '@/engine/time';
import { totalAttribute } from '@/engine/stats';
import { metricValue } from '@/engine/metrics';
import { MAX_MOUNT_TIER } from '@/content/mounts';
import {
  acceptTavernOffer,
  claimMission,
  getTavernOffers,
  missionDurationSec,
  missionEndsAt,
  rerollTavernOffers,
  tavernRerollCost,
  type MissionOffer,
} from '@/engine/missions';
import { createNewSave, deriveEmblem } from '@/engine/newSave';
import { canStartPatrol, collectPatrol, startPatrol } from '@/engine/patrol';
import { applyTimePassage } from '@/engine/timePassage';
import { buyAle, canBuyAle, claimSecondWind } from '@/engine/vigor';

const CADENCES: readonly Cadence[] = ['daily', 'weekly', 'monthly'];

/**
 * `ale-max` / `gacha-max` / `drake-first` are the three GEM STRATEGIES the
 * §8.2 contract pits against each other: they play identically to `optimal`
 * and differ only in where the premium currency goes. If one of them ran away
 * from the others, the well would stop being a choice and start being a tax.
 */
export type Profile = 'optimal' | 'casual' | 'idle-only' | 'ale-max' | 'gacha-max' | 'drake-first';

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
    quests: number;
  };
  gemsFrom: {
    quests: number;
    activityChest: number;
    calendar: number;
    story: number;
    achievements: number;
    dungeons: number;
    arenaMilestones: number;
    wheel: number;
  };
  goldSpentOnAttrs: number;
  goldSpentOnWheel: number;
  goldSpentOnMounts: number;
  /** Where the premium currency went (§8.2 `gem-strategies`) */
  gemsSpent: { ale: number; tosses: number; drake: number };
  /** Collection end-state: what the Menagerie, Stable and Well left behind */
  tosses: number;
  pityHits: number;
  petsOwned: number;
  petLevelsFed: number;
  framesOwned: number;
  mountTier: number;
  /** The single scalar the gem strategies are compared on */
  powerScore: number;
  /**
   * Real-world minutes the hero spent WAITING on missions across the run.
   *
   * This is what a mount actually buys, and `powerScore` structurally cannot
   * see it: vigor meters the day, not the clock, so halving mission time never
   * earns a point of anything — it hands back hours. Without this number the
   * contract could only weigh the Drake's cost, and duly called the Stable's
   * headline animal a trap (B1).
   */
  missionMinutes: number;
  /** Missions actually run — pairs with `missionMinutes` to give minutes/mission. */
  missionsRun: number;
  /** Named legendaries found (CONTENT §6.2) — the long tail's other collection */
  uniquesOwned: number;
  /** Sets fully owned, and set pieces actually WORN — the gacha payoff */
  setsCompleted: number;
  setPiecesEquipped: number;
  equippedCount: number;
  finalRank: number;
  /** every dungeon floor beaten, with the day it fell (dungeon-walls scenario) */
  floorClears: FloorClear[];
  /** zone index → the day its frontier first opened (zone-frontier scenario) */
  zoneFirstDay: Record<number, number>;
  /** total achievement tiers banked and titles earned by the end */
  achievementTiers: number;
  titlesEarned: number;
  storyStepsDone: number;
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
  /**
   * Which of the three arena offers to take. 2 = fight UP, where the honor
   * gap-close lives (BALANCING §4.5); 0 = the safe bout a casual picks.
   * This is POLICY, not profile identity — the gem-strategy profiles inherit
   * optimal's 2, so the only thing that differs between them is the gems.
   */
  arenaOfferIndex: number;
  expeditions: number; // embarkations attempted (L8+, 25 vigor each)
  dungeonSessions: number; // daily visits to the walls (attempts are free, hourly)
  wheelSpins: number; // spins attempted (first free, then rising gold)
  boldEvents: boolean; // expedition events: bold vs safe picks
  /** work the meta layer: quests, activity chest, calendar, story, achievements */
  meta: boolean;
  /**
   * Where the gems go (BALANCING §6 sinks, §8.2 `gem-strategies`):
   *  'none'  — hoarded (idle/casual never generate enough to matter)
   *  'ale'   — every gem becomes vigor, the historical "optimal" line
   *  'gacha' — every gem goes down the well
   *  'drake' — hoard to 60 for the Ember Drake, then ale forever after
   */
  gemPolicy: 'none' | 'ale' | 'gacha' | 'drake';
}

const BASE_POLICIES = {
  optimal: {
    vigorBudget: Infinity,
    secondWind: true,
    patrolCollections: 1,
    playStartHour: 8,
    arenaFights: 10,
    arenaOfferIndex: 2,
    expeditions: 3, // the limit clamps to 2 until Twilight Wanderer completes
    dungeonSessions: 3,
    wheelSpins: 5,
    boldEvents: true,
    meta: true,
    gemPolicy: 'ale',
  },
  casual: {
    vigorBudget: 60,
    secondWind: false,
    patrolCollections: 0,
    playStartHour: 18,
    arenaFights: 6,
    arenaOfferIndex: 0,
    expeditions: 1,
    dungeonSessions: 1,
    wheelSpins: 2,
    boldEvents: false,
    meta: true, // casuals do their dailies; that is the whole point of dailies
    gemPolicy: 'none',
  },
  'idle-only': {
    vigorBudget: 20,
    secondWind: false,
    patrolCollections: 0,
    playStartHour: 20,
    arenaFights: 0,
    arenaOfferIndex: 0,
    expeditions: 0,
    dungeonSessions: 0,
    wheelSpins: 0,
    boldEvents: false,
    meta: false,
    gemPolicy: 'none',
  },
} satisfies Record<'optimal' | 'casual' | 'idle-only', PolicyConfig>;

// The three gem strategies are `optimal` with ONE field changed — anything
// else would make the comparison a test of the policy, not of the economy.
const POLICIES: Record<Profile, PolicyConfig> = {
  ...BASE_POLICIES,
  'ale-max': { ...BASE_POLICIES.optimal, gemPolicy: 'ale' },
  'gacha-max': { ...BASE_POLICIES.optimal, gemPolicy: 'gacha' },
  'drake-first': { ...BASE_POLICIES.optimal, gemPolicy: 'drake' },
};

/** Optimal players pick by value per vigor (xp+gold), not by duration. */
function bestAffordableIndex(offers: MissionOffer[], vigor: number): number {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i]!;
    if (o.vigorCost > vigor) continue;
    const score = (o.xp + o.gold) / o.vigorCost;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Clear out the day's loot — but a real player does NOT vendor a set piece they
 * are collecting, and neither does the simulator.
 *
 * This matters far more than it looks: selling everything made set completion
 * impossible, which silently deleted the entire full-set bonus layer (§4.6)
 * from every measurement and made the Wishing Well — whose whole pitch is being
 * "the luck path to the same sets the dungeons grind out" (§10) — look like a
 * gold faucet with bad rates.
 *
 * Kept: pieces of a set this hero can wear whose slot is not yet held. Sold:
 * everything else, including duplicate slots and other classes' sets, which are
 * genuinely just the most valuable thing in the buy-back book.
 */
function sellBackpack(save: GameSave): number {
  let gold = 0;
  const keep: ItemInstance[] = [];
  // Slots already covered by something WORN. Deliberately not `ownedSetSlots`,
  // which counts the backpack too — every piece would then find itself already
  // owned and be sold, which is exactly the bug this function used to have.
  const equipped = Object.values(save.inventory.equipped).filter(Boolean);
  const held = new Set<string>();
  for (const item of equipped) {
    if (item?.setId) held.add(`${item.setId}:${slotOf(item)}`);
  }
  for (const item of save.inventory.backpack) {
    // A named legendary is one of eight and never comes again (CONTENT §6.2).
    // Nobody vendors those, and a model that did would report the collection as
    // permanently empty — the same shape of bug `held` above exists to avoid.
    if (item.uniqueId) {
      keep.push(item);
      continue;
    }
    const setId = item.setId;
    if (setId) {
      const def = getSet(setId);
      const wearable = def.classId === null || def.classId === save.hero.classId;
      const key = `${setId}:${slotOf(item)}`;
      if (wearable && !held.has(key)) {
        held.add(key);
        keep.push(item);
        continue;
      }
    }
    gold += sellPrice(item);
  }
  save.hero.gold += gold;
  save.inventory.backpack = keep;
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

/**
 * Set pieces carry bonus potential beyond raw stats — nudge the heuristic. A
 * piece cut for another class is discounted by how much of it this hero can
 * actually use: since B1 nothing is class-LOCKED, so the model has to weigh
 * off-class gear the way a player would rather than skip it the way the old
 * `canEquip` gate did.
 */
function scoreWithSetBias(save: GameSave, item: ItemInstance, raw: number): number {
  return (item.rarity === 'set' ? raw * 1.2 : raw) * classFitness(save, item);
}

/** Equip strictly-better drops before selling the rest (the real player habit). */
function equipUpgrades(save: GameSave): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < save.inventory.backpack.length; i++) {
      const item = save.inventory.backpack[i]!;
      const current = save.inventory.equipped[slotOf(item)];
      if (
        !current ||
        scoreWithSetBias(save, item, itemScore(item)) >
          scoreWithSetBias(save, current, itemScore(current))
      ) {
        equipItem(save, i);
        i = -1; // indices shifted; restart the scan
      }
    }
  }
}

/**
 * Wear the set, not just the pieces.
 *
 * Set bonuses only count EQUIPPED pieces (`equippedSets`), and the 2/4/full
 * tiers are where the real power is (§4.6) — a full set is worth far more than
 * the per-slot stat differences the greedy pass above optimises. So once the
 * hero owns enough of a wearable set, put it on wholesale, even where an
 * individual slot takes a small raw-stat loss.
 *
 * Without this the simulator wears a magpie's kit of best-in-slot oddments and
 * never sees a single set bonus, which understates every system that pays in
 * set pieces — dungeons, expeditions and above all the Wishing Well.
 */
function wearBestSet(save: GameSave): void {
  const counts = new Map<string, number>();
  const pool = [...Object.values(save.inventory.equipped), ...save.inventory.backpack];
  for (const item of pool) {
    if (!item?.setId) continue;
    const def = getSet(item.setId);
    if (def.classId !== null && def.classId !== save.hero.classId) continue;
    counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
  }
  let bestSet: string | null = null;
  let bestCount = 1; // a lone piece is not a set — 2 is the first bonus tier
  for (const [setId, n] of counts) {
    if (n > bestCount) {
      bestSet = setId;
      bestCount = n;
    }
  }
  if (bestSet === null) return;
  for (let i = 0; i < save.inventory.backpack.length; i++) {
    const item = save.inventory.backpack[i]!;
    if (item.setId !== bestSet) continue;
    const current = save.inventory.equipped[slotOf(item)];
    if (current?.setId === bestSet) continue;
    equipItem(save, i);
    i = -1; // indices shifted; restart the scan
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

/**
 * Keep the best affordable GOLD mount in the stall. Mounts are the biggest
 * recurring gold sinks in the game (5k / 75k / 1.2M a fortnight, BALANCING §6)
 * and they buy back the scarcest resource there is — real time — so an
 * optimizer keeps one saddled whenever gold allows.
 *
 * Since B1 they are rentals, so this runs every day rather than once per rung:
 * it renews when the term is nearly up and trades up the moment a better animal
 * becomes affordable. Tier 4 is deliberately NOT bought here — the Drake costs
 * gems, and which gems go where is the whole point of `gem-strategies`.
 */
function buyMounts(save: GameSave, nowMs: number): number {
  const active = activeMountTier(save, nowMs);
  // Never downgrade a Drake that gem policy is paying for.
  if (active >= MAX_MOUNT_TIER) return 0;
  let best = 0;
  for (let tier = 1; tier < MAX_MOUNT_TIER; tier++) {
    if (canBuyMount(save, tier)) best = tier;
  }
  if (best === 0) return 0;
  // Buy when there is nothing in the stall, when a better animal is affordable,
  // or when the current rental is down to its last couple of days.
  const stale = active > 0 && mountDaysLeft(save, nowMs) <= 2;
  if (active !== 0 && best <= active && !stale) return 0;
  return buyMount(save, best, nowMs).paid.gold;
}

/**
 * Keep the strongest pet out and pour every treat into it.
 *
 * "Strongest" is scored by what the optimizer actually cares about — growth
 * first (xp, then gold find), raw attributes second, everything else last —
 * because a pet that shortens the climb compounds and a pet that adds 2% armour
 * does not. Treats all go to the equipped pet: spreading them would leave every
 * aura at a fraction of its ceiling.
 */
function auraWeight(kind: string): number {
  if (kind === 'xp') return 6;
  if (kind === 'goldFind') return 4;
  if (kind === 'attrPct') return 3;
  if (kind === 'missionSpeed') return 3;
  if (kind === 'treatFind') return 1.5;
  return 1;
}

function managePets(save: GameSave): void {
  const owned = ownedPets(save);
  if (owned.length === 0) return;
  let best = owned[0]!;
  let bestScore = -1;
  for (const pet of owned) {
    const level = petState(save, pet.id).level;
    const score =
      (auraWeight(pet.major.kind) * pet.major.value +
        auraWeight(pet.minor.kind) * pet.minor.value) *
      (1 + level / 50);
    if (score > bestScore) {
      best = pet;
      bestScore = score;
    }
  }
  if (save.progress.equippedPet !== best.id) equipPet(save, best.id);
  if (canFeedPet(save, best.id)) feedPetMax(save, best.id);
}

/**
 * The one scalar the `gem-strategies` contract compares. Attribute totals are
 * the honest measure of end-state power because every other system feeds them:
 * gear lines, set tiers, elixirs, achievement tiers, pet auras and the
 * collection bonus all resolve through `totalAttribute`.
 */
function powerScore(save: GameSave): number {
  return ATTRIBUTE_IDS.reduce((sum, a) => sum + totalAttribute(save, a), 0);
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
    quests: 0,
  };
  // The gem ledger (BALANCING §6): where the premium currency actually comes
  // from, so the "≈30/week steady state" line can be checked, not assumed.
  const gemsFrom = {
    quests: 0,
    activityChest: 0,
    calendar: 0,
    story: 0,
    achievements: 0,
    dungeons: 0,
    arenaMilestones: 0,
    wheel: 0,
  };
  let goldSpentOnAttrs = 0;
  let goldSpentOnWheel = 0;
  let goldSpentOnMounts = 0;
  /** Wall-clock minutes spent waiting on missions — what a mount buys back. */
  let missionMinutes = 0;
  let missionsRun = 0;
  const gemsSpent = { ale: 0, tosses: 0, drake: 0 };
  let tosses = 0;
  function recordTosses(results: TossResult[]): void {
    tosses += results.length;
  }
  let storyChapter1Day: number | undefined;
  const floorClears: FloorClear[] = [];
  const zoneFirstDay: Record<number, number> = {};

  for (let day = 1; day <= days; day++) {
    const dayStart = START + (day - 1) * 24 * HOUR;
    let now = dayStart + policy.playStartHour * HOUR;

    // Arriving for today's session: bank patrol/resets for everything crossed.
    goldFrom.patrol += applyTimePassage(save, now).patrolGoldBanked;

    if (policy.secondWind && !save.daily.secondWindUsed) claimSecondWind(save);

    // The meta layer opens the day: stamp the calendar, take the boards, and
    // turn yesterday's gems into today's vigor (§8.2 "all gems → ale").
    if (policy.meta) {
      if (canClaimCalendar(save, now)) {
        gemsFrom.calendar += claimCalendarDay(save, now).reward.gems;
      }
      if (save.hero.level >= QUESTS_UNLOCK_LEVEL) {
        for (const cadence of CADENCES) ensureQuestBoard(save, cadence);
      }
    }
    // Where today's gems go (§8.2 `gem-strategies`).
    if (policy.gemPolicy === 'ale') {
      while (canBuyAle(save)) {
        buyAle(save);
        gemsSpent.ale += ALE_COST_GEMS;
      }
    } else if (policy.gemPolicy === 'drake') {
      // Keep the Drake saddled, and put the SURPLUS into ale. Since B1 the
      // Drake is a fortnightly rental, so this is a standing cost rather than a
      // one-time hoard — which is exactly the decision the Stable now keeps
      // asking the player to make.
      //
      // The reserve is the point. A first pass spent every gem on ale the day
      // it arrived and then could not make rent, so the Drake was in the stall
      // barely half the run and "drake-first" was really "ale-max that owns a
      // dragon sometimes". Holding back the next renewal is what a player
      // committed to the Drake actually does.
      const drakeRent = mountPrice(save, MAX_MOUNT_TIER).gems;
      if (activeMountTier(save, now) < MAX_MOUNT_TIER || mountDaysLeft(save, now) <= 2) {
        if (canBuyMount(save, MAX_MOUNT_TIER)) {
          gemsSpent.drake += buyMount(save, MAX_MOUNT_TIER, now).paid.gems;
        }
      }
      while (canBuyAle(save) && save.hero.gems - ALE_COST_GEMS >= drakeRent) {
        buyAle(save);
        gemsSpent.ale += ALE_COST_GEMS;
      }
    }

    // The well: the free daily toss is free, so EVERY meta profile takes it —
    // declining it is never optimal and never interesting. Paid tosses are the
    // gacha-max line only.
    if (policy.meta && save.hero.level >= WELL_UNLOCK_LEVEL) {
      const week = isoWeekNumber(now);
      if (freeTossAvailable(save, 'standard')) {
        recordTosses(toss(save, 'standard', week, 1, now));
      }
      if (policy.gemPolicy === 'gacha') {
        // Always the Featured banner. Measured against picking Standard on the
        // weeks the rate-up set is another class's, this wins: an unwearable
        // set piece is still the most valuable thing in the shop's buy-back
        // book, so the 75% rate-up pays either in gear or in gold. It is also
        // what §7 describes as the intended line ("one set per banner cycle if
        // lucky"), and it keeps the strategy a one-liner rather than a policy
        // the contract would end up measuring instead of the economy.
        // Ten-tosses first (the tenth is discounted), singles for the remainder.
        while (canToss(save, 'featured', TOSS_TEN_COUNT)) {
          gemsSpent.tosses += tossCost(save, 'featured', TOSS_TEN_COUNT);
          recordTosses(toss(save, 'featured', week, TOSS_TEN_COUNT, now));
        }
        while (canToss(save, 'featured', 1)) {
          gemsSpent.tosses += tossCost(save, 'featured', 1);
          recordTosses(toss(save, 'featured', week, 1, now));
        }
      }
    }

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
          goldFrom.expeditions +=
            out.gold + (out.chest?.gold ?? 0) + (out.chest?.autoSoldGold ?? 0);
          now += 4 * 60_000;
        }
      }
    }

    // Mission grind through the persisted tavern board (the real player path).
    let spent = 0;
    const missionsBefore = save.stats.missionsCompleted ?? 0;
    /**
     * The day ends, and unspent vigor dies with it (`applyDailyReset` assigns
     * the allowance rather than adding to it). The loop therefore has to stop at
     * midnight, not merely when the vigor runs out.
     *
     * This was missing, and it made MOUNTS WORTHLESS to the model: the sim
     * would run twenty 20-minute missions back to back regardless of how many
     * hours that took, so halving mission time bought nothing it could measure.
     * Fine while the Drake was a one-off 60 gems — noise. Fatal once B1 made it
     * a 60-gem fortnightly rental, because then the model could see the whole
     * cost and none of the benefit, and duly reported the Stable's headline
     * animal as a trap. Same shape as the M7 set-piece bug: the simulator was
     * quietly not playing the game.
     */
    const dayEnd = dayStart + 24 * HOUR;
    // The floor is half a vigor, not 5: B2 priced the early band at 0.5–2, and
    // a `>= 5` gate would have made the whole fast band unreachable in the model
    // while a real player ran it all day.
    while (save.daily.vigor >= 0.5 && spent < policy.vigorBudget) {
      const budget = Math.min(save.daily.vigor, policy.vigorBudget - spent);
      let idx = bestAffordableIndex(getTavernOffers(save), budget);
      if (idx === -1 && tavernRerollCost(save) === 0) {
        // Free daily reroll when the board offers nothing affordable.
        idx = bestAffordableIndex(rerollTavernOffers(save), budget);
      }
      if (idx === -1) break;
      const offer = getTavernOffers(save)[idx]!;
      // Would it still be running at midnight? Then there is no time for it.
      if (now + missionDurationSec(save, offer.durationMin) * 1000 > dayEnd) break;
      const cost = offer.vigorCost;
      acceptTavernOffer(save, idx, now);
      const startedAt = now;
      now = missionEndsAt(save.activities.mission!);
      missionMinutes += (now - startedAt) / 60_000;
      missionsRun += 1;
      goldFrom.missions += claimMission(save, now).gold;
      spent += cost;
    }

    // Arena bouts (cooldowns interleave with the mission clock; L5 unlock).
    if (save.hero.level >= 5) {
      const offerIdx = policy.arenaOfferIndex;
      for (let f = 0; f < policy.arenaFights && fightsLeft(save) > 0; f++) {
        const outcome = fightArena(save, offerIdx, now);
        goldFrom.arena += outcome.gold;
        gemsFrom.arenaMilestones += outcome.milestoneGems;
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
        gemsFrom.dungeons += out.gems;
        if (out.won) floorClears.push({ dungeonId: dungeon.id, floor: out.floor, day });
      }
    }

    // The Wheel (L5): a net-negative gold sink that pays in items, gems, treats.
    if (save.hero.level >= 5) {
      for (let w = 0; w < policy.wheelSpins && canSpinWheel(save); w++) {
        const out = spinWheel(save);
        goldFrom.wheel += out.gold + out.autoSoldGold;
        gemsFrom.wheel += out.gems;
        goldSpentOnWheel += out.cost;
      }
    }

    // Evening bookkeeping: cash in everything the day's play completed.
    if (policy.meta) {
      for (const cadence of CADENCES) {
        for (const quest of ensureQuestBoard(save, cadence)) {
          if (!canClaimQuest(save, quest)) continue;
          const claim = claimQuest(save, quest.id, now);
          goldFrom.quests += claim.reward.gold + claim.reward.autoSoldGold;
          gemsFrom.quests += claim.reward.gems;
        }
      }
      if (canClaimActivityChest(save)) {
        const chest = claimActivityChest(save, now);
        goldFrom.quests += chest.gold;
        gemsFrom.activityChest += chest.gems;
      }
      for (const chapter of claimableChapters(save)) {
        const claim = claimStep(save, chapter, now);
        goldFrom.quests += claim.reward.gold + claim.reward.autoSoldGold;
        gemsFrom.story += claim.reward.gems;
        if (claim.step.chapter === 1 && claim.step.step === 5) storyChapter1Day ??= day;
      }
      for (const claim of claimAllAchievements(save, now)) {
        gemsFrom.achievements += claim.reward?.gems ?? 0;
      }
    }

    equipUpgrades(save);
    wearBestSet(save);
    goldFrom.selling += sellBackpack(save);
    managePets(save);
    // Mounts before attributes: an attribute point is always available later,
    // whereas a mount compounds over every remaining mission.
    goldSpentOnMounts += buyMounts(save, now);
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

    // When did each zone's frontier first open? (`zone-frontier` scenario)
    const frontier = frontierZoneIndex(save.hero.level);
    for (let z = 1; z <= frontier; z++) zoneFirstDay[z] ??= day;

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
    gemsFrom,
    goldSpentOnAttrs,
    goldSpentOnWheel,
    goldSpentOnMounts,
    gemsSpent,
    tosses,
    pityHits: save.stats.gachaPityHits ?? 0,
    petsOwned: ownedPets(save).length,
    petLevelsFed: save.stats.petLevelsFed ?? 0,
    framesOwned: save.progress.frames.length,
    mountTier: save.progress.mountTier,
    powerScore: powerScore(save),
    missionMinutes: Math.round(missionMinutes),
    missionsRun,
    uniquesOwned: metricValue(save, 'uniquesOwned'),
    setsCompleted: metricValue(save, 'setsCompleted'),
    setPiecesEquipped: Object.values(save.inventory.equipped).filter((i) => i?.setId).length,
    equippedCount: Object.values(save.inventory.equipped).filter(Boolean).length,
    finalRank: records[records.length - 1]?.rank ?? 751,
    floorClears,
    zoneFirstDay,
    achievementTiers: Object.values(save.progress.achievements).reduce((a, b) => a + b, 0),
    titlesEarned: save.progress.titles.length,
    storyStepsDone: Object.values(save.progress.story).reduce((a, b) => a + b, 0),
    records,
  };
}
