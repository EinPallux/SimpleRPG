/**
 * Fresh hero factory — the canonical GameSave v1 shape (invariant 9: any change
 * here is a schema change and needs a migration + fixture).
 */
import { fnv1a } from './hash';
import {
  BACKPACK_BASE_CAPACITY,
  HONOR_START,
  SAVE_VERSION,
  STARTING_GOLD,
  VIGOR_DAILY_BASE,
} from './constants';
import { localDayKey, localMonthKey, isoWeekKey } from './time';
import { initialRngState } from './rng';
import type { ClassId, EmblemSpec, GameSave } from './types';
import { CLASSES, getClass } from '@/content/classes';
import { EMBLEM_ICONS, EMBLEM_PALETTES } from '@/content/emblems';

export interface NewHeroInput {
  name: string;
  classId: ClassId;
  emblem: EmblemSpec;
  worldSeed: string;
}

/** Deterministic default emblem from name+class — same input, same portrait. */
export function deriveEmblem(name: string, classId: ClassId): EmblemSpec {
  const h = fnv1a(`${name.trim().toLowerCase()}|${classId}`);
  const palette = h % EMBLEM_PALETTES.length;
  const preferClassIcon = h % 3 !== 0; // two thirds carry their class sigil
  const icon = preferClassIcon
    ? getClass(classId).emblemIcon
    : (EMBLEM_ICONS[(h >>> 8) % EMBLEM_ICONS.length] ?? getClass(classId).emblemIcon);
  return { icon, palette };
}

export function createNewSave(input: NewHeroInput, nowMs: number): GameSave {
  const iso = new Date(nowMs).toISOString();
  return {
    version: SAVE_VERSION,
    createdAt: iso,
    lastSeenAt: iso,
    worldSeed: input.worldSeed,
    rngState: initialRngState(input.worldSeed),
    hero: {
      name: input.name.trim(),
      classId: input.classId,
      level: 1,
      xp: 0,
      gold: STARTING_GOLD,
      gems: 0,
      scraps: 0,
      dust: 0,
      treats: 0,
      honor: HONOR_START,
      attrsBought: { str: 0, dex: 0, int: 0, con: 0, lck: 0 },
      portrait: input.emblem,
      titleId: null,
      potions: [],
    },
    inventory: { equipped: {}, backpack: [], capacity: BACKPACK_BASE_CAPACITY },
    activities: {
      mission: null,
      expedition: null,
      patrol: null,
      tavernOffers: null,
      dungeonCooldowns: {},
      arena: { fightsToday: 0, cooldownUntil: null },
    },
    daily: {
      dayKey: localDayKey(nowMs),
      vigor: VIGOR_DAILY_BASE,
      secondWindUsed: false,
      aleUsed: 0,
      wheelSpins: 0,
      dismantles: 0,
      expeditions: 0,
      tavernRerollUsed: false,
      freeTossUsed: false,
      activity: 0,
      questSwapUsed: false,
      activityChestClaimed: false,
      questIds: [],
      questProgress: {},
      questsClaimed: [],
      statsAt: {},
    },
    weekly: {
      weekKey: isoWeekKey(nowMs),
      questIds: [],
      questProgress: {},
      questsClaimed: [],
      statsAt: {},
    },
    monthly: {
      monthKey: localMonthKey(nowMs),
      questIds: [],
      questProgress: {},
      questsClaimed: [],
      statsAt: {},
    },
    calendar: { monthKey: localMonthKey(nowMs), claimedDays: [], lastClaimDayKey: null },
    town: {
      shops: {
        weaponsmith: { stock: null, rerollUsed: false },
        armorer: { stock: null, rerollUsed: false },
        arcanum: { stock: null, rerollUsed: false },
      },
    },
    progress: {
      story: {},
      zonesUnlocked: 1,
      zonePinned: null,
      dungeonFloors: {},
      codex: { monstersSeen: {}, itemsSeen: {}, loreSeen: {} },
      achievements: {},
      titles: [],
      frames: [],
      pets: {},
      equippedPet: null,
      mountTier: 0,
      gachaPity: {},
      milestonesClaimed: [],
    },
    stats: {},
  };
}

/** Base attribute total (class start + bought) — gear/achievements join in M3/M6. */
export function baseAttribute(save: GameSave, attr: keyof GameSave['hero']['attrsBought']): number {
  const cls = CLASSES.find((c) => c.id === save.hero.classId);
  return (cls?.startAttrs[attr] ?? 0) + save.hero.attrsBought[attr];
}
