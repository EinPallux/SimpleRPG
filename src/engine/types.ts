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
export interface TimedActivity {
  kind: string;
  startedAt: string; // ISO
  durationSec: number;
}

export interface ActivePotion {
  elixirId: string;
  attribute: AttributeId;
  expiresAt: string; // ISO
}

export interface ItemInstance {
  id: string;
  defId: string;
  ilvl: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'set' | 'legendary';
  lines: { attr: AttributeId | 'all' | 'critDmg' | 'goldFind' | 'xp'; value: number }[];
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
  /** Serialized rng stream states arrive with M1 (src/engine/rng.ts). */
  rngState: Record<string, unknown>;
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
    mission: TimedActivity | null;
    expedition: TimedActivity | null;
    patrol: TimedActivity | null;
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
