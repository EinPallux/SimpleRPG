/**
 * Every tunable constant, named exactly as in BALANCING.md §1 (single source of
 * truth — CLAUDE.md invariant 5). Changing a value here requires the balance
 * simulator scenarios to stay green (from M1 on) and a row in BALANCING.md §10.
 */

export const SAVE_VERSION = 7;
export const TAVERN_REROLL_COST_GEMS = 1;

// Shops (GAME_DESIGN.md §9.5, BALANCING.md §5.3–5.4)
export const SHOP_STOCK_SIZE = 6;
export const SHOP_REROLL_COST_GEMS = 1;
export const DROP_WEIGHTS_SHOP = [
  ['common', 30],
  ['uncommon', 34],
  ['rare', 26],
  ['epic', 10],
] as const;

// Elixirs (GAME_DESIGN.md §9.5, BALANCING.md §5.4)
export const POTION_SLOTS = 3;
export const ELIXIR_PCT = [0.1, 0.15, 0.25] as const; // tier 1..3: % of the attribute
export const ELIXIR_PRICE_MULT = [1.5, 4, 10] as const; // × missionGold(L,10)
export const ELIXIR_DURATION_H = 24;

// Forge (BALANCING.md §5.5)
export const FORGE_UPGRADE_MAX = 20;
export const UPGRADE_STAT_PER_LEVEL = 0.025;
export const FORGE_GOLD_COEF = 0.12; // gold = 0.12 × k^1.8 × shopPrice(item)
export const FORGE_GOLD_EXP = 1.8;

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

// Bot world (GAME_DESIGN.md §8.3, BALANCING.md §4.5)
export const WORLD_AGE_DAYS = 21; // the "server" is 3 weeks old at character creation
export const BOT_ARCHETYPE_DIST = [
  ['nolifer', 4],
  ['dedicated', 21],
  ['regular', 45],
  ['casual', 22],
  ['dormant', 8],
] as const;
/** daily mission-equivalents (10-vigor units) each archetype averages */
export const BOT_DAILY_EQUIV = {
  nolifer: 20.5, // ≈ a full-optimal player incl. expeditions/dungeons — the long rival
  dedicated: 16,
  regular: 11,
  casual: 5.2,
  dormant: 1.25,
} as const;
export const BOT_WEEKEND_MULT = 1.3;
export const BOT_QUIT_CHANCE_PER_MONTH = 0.02; // rage-quit → replaced by a fresh joiner
/** honor(level) = BOT_HONOR_COEF × levelEquiv^BOT_HONOR_EXP × affinity(0.7–1.3) */
export const BOT_HONOR_COEF = 90; // tuned so optimal play crosses rank 1 ≈ day 175 (§8.2 ladder-rank1)
export const BOT_HONOR_EXP = 1.15;

// Arena honor — place-swap model (BALANCING.md §4.5): beating someone vaults
// you just above THEIR honor; the ladder is paced by who you can actually beat.
export const HONOR_WIN_MIN = 5; // wins "down" still nudge you up a little
export const HONOR_LEAPFROG_BONUS = 5; // honor lands at theirHonor + this…
export const HONOR_LEAP_CAP_FLAT = 15; // …but a single win can only leap so far:
export const HONOR_LEAP_CAP_PCT = 0.001; // max(15, 0.1% of your honor) — walls need sustained wins
export const HONOR_LOSS_FACTOR = 0.05;
export const HONOR_LOSS_BASE = 6;
export const HONOR_LOSS_MIN = 3;
export const HONOR_FLOOR = 25; // honor can never fall below this
export const ARENA_COOLDOWN_SKIP_GEMS = 1;
export const ARENA_WIN_GOLD_MULT = 0.6; // × missionGold(L,10)
export const ARENA_LOSS_GOLD_MULT = 0.09;
export const ARENA_WIN_XP_MULT = 0.25; // × missionXp(L,10)
export const ARENA_CHEST_CHANCE = 0.2;
/** first-time rank milestones → gems (CONTENT_CATALOG.md §8) */
export const ARENA_MILESTONES: readonly (readonly [number, number])[] = [
  [500, 5],
  [250, 8],
  [100, 12],
  [50, 15],
  [25, 20],
  [10, 25],
  [3, 30],
  [1, 50],
];

// Dungeons (GAME_DESIGN.md §15, BALANCING.md §4/§4.6) — the stat walls
export const DUNGEON_BOSS_ATTR_BASE = 1.15; // M_attr(f) = 1.15 + 0.01×f
export const DUNGEON_BOSS_ATTR_PER_FLOOR = 0.01;
export const DUNGEON_BOSS_HP_BASE = 2.2; // M_hp(f) = 2.2 + 0.08×f
export const DUNGEON_BOSS_HP_PER_FLOOR = 0.08;
export const DUNGEON_BOSS_ARMOR_MULT = 1.1;
export const DUNGEON_FLOOR_GOLD_MULT = 1.0; // × missionGold(L,10), on clear
export const DUNGEON_FLOOR_XP_MULT = 1.5; // × missionXp(L,10), on clear (one-time by design)
// Gem purses are sized against the §6 one-time pool (~55 across all 50 floors),
// not per-floor generosity — see §10 2026-07-28 (M6 gem re-anchor).
export const DUNGEON_FLOOR_GEMS = 1; // every floor clear…
export const DUNGEON_SET_FLOOR_GEMS = 3; // …but set floors (5 & 10) pay more…
export const DUNGEON_CLEAR_GEMS = 5; // …and finishing floor 10 adds this on top

// Expeditions (GAME_DESIGN.md §16, BALANCING.md §4.6)
export const EXPEDITION_STEPS = 5;
export const EXPED_CARD_WEIGHTS = [
  ['fight', 60],
  ['treasure', 25],
  ['event', 15],
] as const;
export const HEROISM_SILVER = 20; // chest tiers: Bronze < 20 ≤ Silver < 35 ≤ Gold
export const HEROISM_GOLD = 35;
export const HEROISM_FIGHT_WIN = 8;
export const HEROISM_FIGHT_LOSS = 3; // losing never bricks a run — it just pays less
export const HEROISM_MINIBOSS_WIN = 14;
export const HEROISM_MINIBOSS_LOSS = 4;
export const HEROISM_TREASURE = 4;
export const EXPED_TREASURE_GOLD_MULT = 0.35; // × missionGold(L,10)
export const EXPED_FIGHT_GOLD_MULT = 0.15; // per won fight (miniboss ×2)
export const EXPED_CHEST_GOLD = { bronze: 1.1, silver: 1.4, gold: 1.7 } as const; // × M10
export const EXPED_CHEST_XP = { bronze: 0.9, silver: 1.1, gold: 1.35 } as const; // × M10-XP
export const EXPED_GOLD_CHEST_SET_CHANCE = 0.12; // Gold chests may hold a set piece

// Wheel of Destiny (GAME_DESIGN.md §14, CONTENT_CATALOG.md §11)
export const WHEEL_SPIN_COSTS = [0, 0.4, 0.8, 1.6, 3.2] as const; // × missionGold(L,10)
export const WHEEL_GOLD = { goldS: 0.5, goldM: 1.0, goldL: 2.5 } as const; // × M10
export const WHEEL_XP_MULT = 0.6; // × missionXp(L,10)
export const WHEEL_SCRAPS = 6;
export const WHEEL_TREATS = 3;
export const WHEEL_DUST = 2;
export const WHEEL_GEMS = 1;
export const WHEEL_JACKPOT_GEMS = 25; // fallback once pets exist and the snail is owned (M7)

// ---------------------------------------------------------------------------
// Pets, Mounts & the Wishing Well (GAME_DESIGN.md §10–11, BALANCING.md §4.7/§7)
// ---------------------------------------------------------------------------

export const STABLE_UNLOCK_LEVEL = 10; // §11.2
export const WELL_UNLOCK_LEVEL = 18; // §10
export const MENAGERIE_UNLOCK_LEVEL = 35; // §11.1 — arrives with story chapter 5

/**
 * Daily resets crossed before the PWA install nudge is allowed to appear
 * (UI_DESIGN §8: "after day-2 login — never on first session").
 *
 * `stats.daysPlayed` counts CROSSED resets, so it is 0 all through day one and
 * 1 on the day-two login — which makes 1, not 2, the value that matches the
 * doc. At 2 the card would first appear on day three.
 */
export const INSTALL_PROMPT_MIN_DAYS = 1;

/**
 * Share of legendary drops that become one of the eight NAMED legendaries
 * instead of a generated one (CONTENT §6.2), when the hero is still missing at
 * least one their class can wear.
 *
 * Sized against how rare legendaries already are — the wheel jackpot, the 1%
 * well row and deep dungeon floors — so the set of eight is a long chase across
 * the whole v1.0 horizon rather than a side quest. Owned uniques are never
 * re-offered, so this is a share of *progress*, not a lottery you can lose to
 * duplicates (engine/uniques.ts).
 */
export const UNIQUE_DROP_SHARE = 0.35;

/**
 * Treats to go from pet level L to L+1: `ceil(BASE × L^EXP × rarityMult)`.
 *
 * Shaped to be generous at the start and a genuine long-tail at the end: the
 * first ten levels of a common pet cost ~81 treats (a couple of days), all
 * forty-nine cost ~2,530 (~12 weeks at the ~30/day the faucets below pay), and
 * a legendary doubles that. Pets are the one system explicitly allowed to
 * outlast the 6–9 month v1.0 horizon — the aura is already 2/3 grown by L30, so
 * the tail is completionism, not a power gate (BALANCING §4.7).
 */
export const PET_TREAT_BASE = 1.5;
export const PET_TREAT_EXP = 1.1;
export const PET_TREAT_RARITY_MULT = {
  common: 1,
  rare: 1.2,
  epic: 1.5,
  legendary: 2,
} as const;

/** Treat faucets (§11.1: "missions, patrol ticks, quests, wheel"). */
export const TREATS_PER_MISSION = 1;
export const PATROL_TICKS_PER_TREAT = 2; // one treat per hour of patrol

/** The Wishing Well's prices (§10). The 10-toss saves one toss in ten. */
export const TOSS_COST_GEMS = 5;
export const TOSS_TEN_COST_GEMS = 45;
export const TOSS_TEN_COUNT = 10;

/**
 * Dupe conversion (BALANCING §7): a set or legendary you already own becomes
 * dust and codex credit; a pet you already own becomes treats. Nothing the
 * well returns is ever truly wasted — that is the whole ethical-gacha promise.
 */
export const DUPE_SET_DUST = 2;
export const DUPE_LEGENDARY_DUST = 3;
export const DUPE_PET_TREATS = 40;

/**
 * The consumable bundle, in the wheel's units so the two small-prize faucets
 * stay comparable. A bundle is worth clearly less than the 5 gems it cost —
 * the well is a *sink*, and its expected value lives in the 18% gear rows.
 */
export const WELL_BUNDLE_GOLD = 2.5; // × missionGold(L, 10)
export const WELL_BUNDLE_SCRAPS = 8;
export const WELL_BUNDLE_TREATS = 12;
/**
 * …and the fourth thing §7 lists in the bundle: a potion. It is the only part
 * of the consolation prize that is POWER rather than materials, which is what
 * keeps a well-focused hero within reach of an ale-focused one — gold alone
 * cannot, because the attribute curve (§3.2) eats it faster than the well can
 * pour it in.
 */
export const WELL_BUNDLE_ELIXIR_CHANCE = 0.25;

/**
 * Item levels the well rolls gear at, relative to the hero.
 *
 * The well is a PREMIUM-currency source and §10 sells it as "the luck path to
 * the same sets the dungeons grind out" — so its gear has to be gear you would
 * actually equip. Rolled at exactly the hero's level it almost never beats what
 * a dungeon floor already handed over, which quietly turned the whole 38% gear
 * slice of the odds table into vendor trash.
 */
export const WELL_GEAR_ILVL_BONUS = 5;
export const WELL_LEGENDARY_ILVL_BONUS = 8;

// Quests, Activity meter & the meta layer (GAME_DESIGN.md §12–14)
export const QUEST_SLOTS = 3; // dailies on the board
export const WEEKLY_QUEST_SLOTS = 3;
export const MONTHLY_QUEST_SLOTS = 2;
export const QUESTS_UNLOCK_LEVEL = 6;
export const CODEX_UNLOCK_LEVEL = 25;
export const CALENDAR_UNLOCK_LEVEL = 18;
export const ACTIVITY_MAX = 100;
/** Core-loop trickle into the Activity meter — dailies carry the rest. */
export const ACTIVITY_PER_MISSION = 1.5;
export const ACTIVITY_PER_ARENA_FIGHT = 1.5;
export const ACTIVITY_PER_EXPEDITION = 6;
export const ACTIVITY_PER_DUNGEON_FLOOR = 4;
export const ACTIVITY_PER_WHEEL_SPIN = 1;
/** The Daily Chest at 100 activity (GAME_DESIGN §12.2). */
export const ACTIVITY_CHEST_GOLD_MULT = 3; // × missionGold(L,10)
export const ACTIVITY_CHEST_SCRAPS = 8;
export const ACTIVITY_CHEST_GEM_CHANCE = 0.4;
/** Achievements: every claimed tier is +3 to ALL attributes, forever (§13). */
export const ACHIEVEMENT_ATTR_PER_TIER = 3;
/** Codex page-completion bonuses, capped globally by CAP_GOLD_FIND / CAP_XP_BONUS. */
export const CODEX_GOLD_PER_ZONE = 0.01; // +1% gold find per completed zone page
export const CODEX_XP_PER_ARMORY_TIER = 0.01; // +1% XP per completed armory tier

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
/** Shop prices can never be discounted past this, however many auras stack. */
export const CAP_SHOP_DISCOUNT = 0.5;

// Par seed curves (BALANCING.md §2.4 — analytic seeds until `pnpm sim --par` regenerates)
export const PAR_MAIN_COEF = 0.9; // parMainAttr(L) = round(0.9 × L^1.45)
export const PAR_MAIN_EXP = 1.45;
export const PAR_CON_COEF = 0.63;
export const PAR_ARMOR_PER_LEVEL = 10.7; // medium-armor full kit baseline → ~27% DR
