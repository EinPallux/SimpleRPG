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
    expedition: TimedActivity | null;
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
    tavernRerollUsed: boolean;
    freeTossUsed: boolean;
    activity: number;
    questIds: string[];
    questProgress: Record<string, number>;
  };
  weekly: { weekKey: string; questIds: string[]; questProgress: Record<string, number> };
  monthly: { monthKey: string; questIds: string[]; questProgress: Record<string, number> };
  calendar: { monthKey: string; claimedDays: number[]; lastClaimDayKey: string | null };
  progress: {
    storyStep: number;
    zonesUnlocked: number;
    zonePinned: number | null;
    dungeonFloors: Record<string, number>;
    codex: { monstersSeen: Record<string, number>; itemsSeen: Record<string, true> };
    achievements: Record<string, number>;
    pets: Record<string, { owned: boolean; level: number }>;
    equippedPet: string | null;
    mountTier: number;
    gachaPity: Record<string, { sinceEpic: number; sinceSet: number }>;
    milestonesClaimed: string[];
  };
  stats: Record<string, number>;
}

export interface SlotSummary {
  slot: number;
  name: string;
  classId: ClassId;
  level: number;
  portrait: EmblemSpec;
  updatedAt: string;
}
