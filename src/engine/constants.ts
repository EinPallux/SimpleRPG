/**
 * Every tunable constant, named exactly as in BALANCING.md §1 (single source of
 * truth — CLAUDE.md invariant 5). Changing a value here requires the balance
 * simulator scenarios to stay green (from M1 on) and a row in BALANCING.md §10.
 */

export const SAVE_VERSION = 2;

// Vigor — the daily adventure energy (GAME_DESIGN.md §4)
export const VIGOR_DAILY_BASE = 100;
export const REFILL_SECOND_WIND = 50;
export const ALE_VIGOR = 20;
export const ALE_MAX_PER_DAY = 5;
export const ALE_COST_GEMS = 2;
export const VIGOR_DAILY_MAX = 250; // 100 + 50 + 5×20

// Activities
export const MISSION_DURATIONS = [5, 10, 15, 20] as const; // minutes == vigor cost
export const EXPEDITION_COST = 25;
export const EXPEDITIONS_PER_DAY = 2;
export const ARENA_FIGHTS_PER_DAY = 10;
export const ARENA_COOLDOWN_MIN = 10;
export const WHEEL_SPINS_PER_DAY = 5;
export const DISMANTLES_PER_DAY = 5;
export const DUNGEON_COOLDOWN_MIN = 60;
export const PATROL_TICK_MIN = 30;
export const PATROL_CAP_HOURS = 8;

// Loot
export const MISSION_ITEM_CHANCE = 0.33;
export const MISSION_CHEST_CHANCE = 0.05;
export const ZONE_DECAY = 0.08;

// Mounts: duration reduction by tier 0..4
export const MOUNT_SPEED = [0, 0.1, 0.2, 0.3, 0.5] as const;

// Hero
export const HONOR_START = 100;
export const BACKPACK_BASE_CAPACITY = 30;
export const STARTING_GOLD = 0;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 16;

// World
export const BOT_COUNT = 750;
export const SAVE_SLOTS = 3;

// Progression curves (BALANCING.md §2)
export const XP_BASE = 100; // xpToNext = ceil(XP_BASE × L^XP_EXP)
export const XP_EXP = 2.4;
export const MPL_BASE = 1.2; // MPL = MPL_BASE × (1 + L/MPL_DIV)^MPL_EXP  (§10 changelog 2026-07-28)
export const MPL_DIV = 12;
export const MPL_EXP = 2;
export const GOLD_PER_10VIGOR_BASE = 18; // missionGold(L,10) = ceil(18 × L^GOLD_EXP)
export const GOLD_EXP = 1.9;
export const PATROL_GOLD_RATE = 0.3; // × missionGold(L,10) per hour
export const PATROL_XP_RATE = 0.1; // × missionXP(L,10) per hour
export const ATTR_COST_DIV = 8; // attrCost(n) = min(cap, ceil(n^2.5 / 8))
export const ATTR_COST_EXP = 2.5;
export const ATTR_COST_CAP = 10_000_000;

// Combat (BALANCING.md §3)
export const RAGE_PER_ROUND = 0.05;
export const ROUND_CAP = 100;
export const DR_DIVISOR = 40; // DR = min(DR_CAP, armor / (attackerLevel × 40))
export const DR_CAP = 0.5;
export const EFF_MAIN_FLOOR = 0.33; // effMain ≥ main × floor
export const CRIT_PER_LUCK = 2.5; // crit% = min(cap, LCK × 2.5 / enemyLevel)
export const CRIT_CAP = 0.5;
export const CRIT_CAP_ASSASSIN = 0.6;
export const CRIT_MULT = 2.0;
export const CRIT_MULT_SCOUT = 2.5;
export const BLOCK_WARRIOR = 0.25;
export const EVADE_SCOUT = 0.35;
export const EVADE_ASSASSIN = 0.15;
export const MAGE_DMG_MULT = 1.9;
export const ASSASSIN_STRIKES = 2;
export const ASSASSIN_STRIKE_MULT = 0.65;
export const UNARMED_DAMAGE: readonly [number, number] = [1, 3];

// Items (BALANCING.md §5)
export const WEAPON_BASE = 3; // wMin/max around (3 + 2.2×ilvl) × (1 ∓ 0.15)
export const WEAPON_PER_ILVL = 2.2;
export const WEAPON_SPREAD = 0.15;
export const ARMOR_PER_ILVL = 2.6;
export const SLOT_WEIGHTS = {
  chest: 1.0,
  helmet: 0.7,
  boots: 0.55,
  gloves: 0.55,
  belt: 0.5,
  offhand: 0.8,
} as const;
export const RARITY_LINES = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  set: 3,
  legendary: 3,
} as const;
export const RARITY_BASE_MULT = {
  common: 1,
  uncommon: 1,
  rare: 1,
  epic: 1.1,
  set: 1.1,
  legendary: 1.2,
} as const;
export const RARITY_VALUE_MULT = {
  common: 1,
  uncommon: 1.8,
  rare: 3.2,
  epic: 6,
  set: 9,
  legendary: 12,
} as const;
export const LINE_VALUE_PER_ILVL = 0.55; // attr line = ceil(0.55 × ilvl); +All = 60% of that
export const ALL_ATTR_LINE_FACTOR = 0.6;
export const SHOP_PRICE_MULT = 2.2; // × itemValue; itemValue = ilvl^1.75 × rarityValueMult
export const ITEM_VALUE_EXP = 1.75;
export const SELL_PRICE_MULT = 0.2;
export const DROP_ILVL_SPREAD = 2; // drop ilvl = playerLevel ± 2
export const DISMANTLE_SCRAPS = {
  common: 1,
  uncommon: 2,
  rare: 4,
  epic: 8,
  set: 15,
  legendary: 15,
} as const;
export const DISMANTLE_DUST = {
  common: 0,
  uncommon: 0,
  rare: 0,
  epic: 1,
  set: 2,
  legendary: 3,
} as const;

// Drop rarity weights by source (BALANCING.md §5.3)
export const DROP_WEIGHTS_MISSION = [
  ['common', 52],
  ['uncommon', 28],
  ['rare', 14],
  ['epic', 5.5],
  ['legendary', 0.5],
] as const;
export const DROP_WEIGHTS_CHEST = [
  ['common', 25],
  ['uncommon', 35],
  ['rare', 25],
  ['epic', 13],
  ['legendary', 2],
] as const;

// Luck's second job (BALANCING.md §5.6)
export const ITEM_CHANCE_LUCK_MAX_BONUS = 0.12;
export const ITEM_CHANCE_CAP = 0.45;

// Time guard (TECHNICAL_ARCHITECTURE.md §6)
export const CLOCK_ROLLBACK_GRACE_MS = 10 * 60_000;

// Enemy archetype templates (BALANCING.md §4) — multipliers over par at target level
export const ARCHETYPE_TEMPLATES = {
  grunt: {
    attr: 0.85,
    hp: 0.9,
    armor: 0.8,
    evade: 0,
    unblockable: false,
    brute: false,
    critBonus: 0,
  },
  swift: {
    attr: 0.95,
    hp: 0.75,
    armor: 0.6,
    evade: 0.1,
    unblockable: false,
    brute: false,
    critBonus: 0,
  },
  caster: {
    attr: 1.05,
    hp: 0.7,
    armor: 0.4,
    evade: 0,
    unblockable: true,
    brute: false,
    critBonus: 0,
  },
  brute: {
    attr: 0.9,
    hp: 1.35,
    armor: 0.7,
    evade: 0,
    unblockable: false,
    brute: true,
    critBonus: 0,
  },
  elite: {
    attr: 1.1,
    hp: 1.15,
    armor: 1.0,
    evade: 0,
    unblockable: false,
    brute: false,
    critBonus: 0.05,
  },
} as const;
export type ArchetypeId = keyof typeof ARCHETYPE_TEMPLATES;

// Gear % line global caps (BALANCING.md §5.2)
export const CAP_GOLD_FIND = 0.4;
export const CAP_XP_BONUS = 0.3;
export const CAP_CRIT_DMG_BONUS = 0.5;
export const CAP_BLOCK = 0.35;
export const CAP_EVADE = 0.5;

// Par seed curves (BALANCING.md §2.4 — analytic seeds until `pnpm sim --par` regenerates)
export const PAR_MAIN_COEF = 0.9; // parMainAttr(L) = round(0.9 × L^1.45)
export const PAR_MAIN_EXP = 1.45;
export const PAR_CON_COEF = 0.63;
export const PAR_ARMOR_PER_LEVEL = 10.7; // medium-armor full kit baseline → ~27% DR
