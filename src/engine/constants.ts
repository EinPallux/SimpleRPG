/**
 * Every tunable constant, named exactly as in BALANCING.md §1 (single source of
 * truth — CLAUDE.md invariant 5). Changing a value here requires the balance
 * simulator scenarios to stay green (from M1 on) and a row in BALANCING.md §10.
 */

export const SAVE_VERSION = 1;

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
