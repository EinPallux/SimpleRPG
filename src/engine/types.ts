/**
 * Core domain types shared by engine, persistence, state and UI.
 * The persisted shape (`GameSave`) mirrors TECHNICAL_ARCHITECTURE.md §3 and is
 * validated by the zod schema in `src/persist/schema.ts` (kept in lockstep —
 * invariant 9: every shape change ships a migration + fixture test).
 */

export type ClassId = 'warrior' | 'scout' | 'mage' | 'assassin';
export type AttributeId = 'str' | 'dex' | 'int' | 'con' | 'lck';

export const ATTRIBUTE_IDS: readonly AttributeId[] = ['str', 'dex', 'int', 'con', 'lck'];

/** Procedural portrait: an icon composed over a palette, framed in class color. */
export interface EmblemSpec {
  icon: string;
  palette: number;
}

/** Any real-time activity: remaining time is always derived, never counted down. */
export interface TimedActivity<P = unknown> {
  kind: string;
  startedAt: string; // ISO
  durationSec: number;
  payload: P;
}

export interface MissionPayload {
  zoneIndex: number;
  durationMin: number;
  lucky: boolean;
  /** rewards locked in at start (zone multiplier applied) */
  xp: number;
  gold: number;
  /** flavor-pool roll (mapped to zone/generic mission texts at render) */
  flavor: number;
}

export interface PatrolPayload {
  /** accrual already collected up to this instant */
  collectedUpTo: string;
}

/**
 * One face-down card in an expedition encounter (GAME_DESIGN §16).
 * Fight cards name a real monster from the hero's frontier zone (CONTENT §4),
 * which is what fills the Bestiary — `monsterId` is optional only so that
 * expeditions already in flight across the M6 upgrade keep working.
 */
export type ExpeditionCard =
  | { kind: 'fight'; foe: 'grunt' | 'swift' | 'caster' | 'brute'; monsterId?: string }
  | { kind: 'miniboss' }
  | { kind: 'treasure' }
  | { kind: 'event'; eventIndex: number };

/**
 * One cadence's quest slate (GAME_DESIGN §12.2). Progress is never written by
 * the systems that generate it: it is always `stats[metric] − statsAt[metric]`,
 * so a quest can't desync from the ledger and offline catch-up is free.
 */
export interface QuestBlock {
  questIds: string[];
  /** cached progress for display; recomputed from the ledger on every read */
  questProgress: Record<string, number>;
  questsClaimed: string[];
  /** the stat ledger as it stood when this period began */
  statsAt: Record<string, number>;
}

/** An expedition in progress: 5 encounters, pick 1 of 3 revealed cards each. */
export interface ExpeditionState {
  localeId: string;
  /** encounter index 0..4 */
  step: number;
  heroism: number;
  /** current encounter's three cards (null = roll on next visit) */
  cards: ExpeditionCard[] | null;
}

export interface ActivePotion {
  elixirId: string;
  attribute: AttributeId;
  expiresAt: string; // ISO
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'set' | 'legendary';
export type BonusLineType = AttributeId | 'all' | 'critDmg' | 'goldFind' | 'xp';

export interface ItemInstance {
  id: string;
  defId: string;
  ilvl: number;
  rarity: Rarity;
  /** class the piece is cut for (armor weight, weapon type); null = any class */
  classId: ClassId | null;
  lines: { attr: BonusLineType; value: number }[];
  upgrade: number;
  seed: number;
  /** set membership (rarity 'set' pieces only; content/sets.ts) */
  setId?: string;
}

export type EquipSlot =
  | 'weapon'
  | 'offhand'
  | 'helmet'
  | 'chest'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'amulet'
  | 'ring'
  | 'talisman';

export interface GameSave {
  version: number;
  createdAt: string;
  lastSeenAt: string;
  worldSeed: string;
  /** Serialized rng stream states (src/engine/rng.ts); missing streams lazy-init from worldSeed. */
  rngState: Partial<Record<import('./rng').StreamName, import('./rng').RngState>>;
  hero: {
    name: string;
    classId: ClassId;
    level: number;
    xp: number;
    gold: number;
    gems: number;
    scraps: number;
    dust: number;
    treats: number;
    honor: number;
    attrsBought: Record<AttributeId, number>;
    portrait: EmblemSpec;
    titleId: string | null;
    potions: ActivePotion[];
  };
  inventory: {
    equipped: Partial<Record<EquipSlot, ItemInstance>>;
    backpack: ItemInstance[];
    capacity: number;
  };
  activities: {
    mission: TimedActivity<MissionPayload> | null;
    expedition: ExpeditionState | null;
    patrol: TimedActivity<PatrolPayload> | null;
    /** the three standing offers on the tavern board (null = roll on next visit) */
    tavernOffers:
      | {
          zoneIndex: number;
          durationMin: number;
          lucky: boolean;
          xp: number;
          gold: number;
          flavor: number;
        }[]
      | null;
    dungeonCooldowns: Record<string, string>;
    arena: { fightsToday: number; cooldownUntil: string | null };
  };
  daily: {
    dayKey: string;
    vigor: number;
    secondWindUsed: boolean;
    aleUsed: number;
    wheelSpins: number;
    dismantles: number;
    /** expeditions embarked on today (cap EXPEDITIONS_PER_DAY, +1 with Twilight full set) */
    expeditions: number;
    tavernRerollUsed: boolean;
    freeTossUsed: boolean;
    activity: number;
    /** the one free daily swap (GAME_DESIGN §12.2 — no feel-bads) */
    questSwapUsed: boolean;
    /** the Activity Chest at 100 points */
    activityChestClaimed: boolean;
  } & QuestBlock;
  weekly: { weekKey: string } & QuestBlock;
  monthly: { monthKey: string } & QuestBlock;
  calendar: { monthKey: string; claimedDays: number[]; lastClaimDayKey: string | null };
  progress: {
    /** chapter number → steps completed (0..5). Chapters gate by level and
     *  advance independently (GAME_DESIGN §12.1). */
    story: Record<string, number>;
    zonesUnlocked: number;
    zonePinned: number | null;
    dungeonFloors: Record<string, number>;
    codex: {
      monstersSeen: Record<string, number>;
      itemsSeen: Record<string, true>;
      /** lore entries actually opened (the Scholar's secret achievement) */
      loreSeen: Record<string, true>;
    };
    /** achievement id → tiers claimed (0..tiers.length) */
    achievements: Record<string, number>;
    titles: string[];
    frames: string[];
    pets: Record<string, { owned: boolean; level: number }>;
    equippedPet: string | null;
    mountTier: number;
    gachaPity: Record<string, { sinceEpic: number; sinceSet: number }>;
    milestonesClaimed: string[];
  };
  town: {
    shops: Record<ShopId, ShopState>;
  };
  stats: Record<string, number>;
}

export type ShopId = 'weaponsmith' | 'armorer' | 'arcanum';

export interface ShopState {
  /** null = roll fresh stock on next visit (daily reset clears it) */
  stock: (ItemInstance | null)[] | null;
  rerollUsed: boolean;
}

export interface SlotSummary {
  slot: number;
  name: string;
  classId: ClassId;
  level: number;
  portrait: EmblemSpec;
  updatedAt: string;
}
