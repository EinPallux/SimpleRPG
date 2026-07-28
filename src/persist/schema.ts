/**
 * Zod mirror of GameSave (engine/types.ts) — the load/import gatekeeper.
 * Kept strict: unknown keys are a schema drift signal, not tolerated silently.
 */
import { z } from 'zod';
import type { GameSave } from '@/engine/types';

const attributeId = z.enum(['str', 'dex', 'int', 'con', 'lck']);
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid ISO date');

const rngStateTuple = z.tuple([
  z.number().int(),
  z.number().int(),
  z.number().int(),
  z.number().int(),
]);

const missionOffer = z
  .object({
    zoneIndex: z.number().int().min(1),
    durationMin: z.number().int().positive(),
    lucky: z.boolean(),
    xp: z.number().int().min(0),
    gold: z.number().int().min(0),
    flavor: z.number().int().min(0),
  })
  .strict();

const missionActivity = z
  .object({
    kind: z.literal('mission'),
    startedAt: isoDate,
    durationSec: z.number().nonnegative(),
    payload: missionOffer,
  })
  .strict();

const patrolActivity = z
  .object({
    kind: z.literal('patrol'),
    startedAt: isoDate,
    durationSec: z.number().nonnegative(),
    payload: z.object({ collectedUpTo: isoDate }).strict(),
  })
  .strict();

const expeditionCard = z.union([
  z
    .object({
      kind: z.literal('fight'),
      foe: z.enum(['grunt', 'swift', 'caster', 'brute']),
      monsterId: z.string().optional(),
    })
    .strict(),
  z.object({ kind: z.literal('miniboss') }).strict(),
  z.object({ kind: z.literal('treasure') }).strict(),
  z.object({ kind: z.literal('event'), eventIndex: z.number().int().min(0).max(23) }).strict(),
]);

const expeditionState = z
  .object({
    localeId: z.string(),
    step: z.number().int().min(0).max(4),
    heroism: z.number().min(0),
    cards: z.array(expeditionCard).length(3).nullable(),
  })
  .strict();

const itemLine = z
  .object({
    attr: z.union([attributeId, z.enum(['all', 'critDmg', 'goldFind', 'xp'])]),
    value: z.number(),
  })
  .strict();

const itemInstance = z
  .object({
    id: z.string(),
    defId: z.string(),
    ilvl: z.number().int().positive(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'set', 'legendary']),
    classId: z.enum(['warrior', 'scout', 'mage', 'assassin']).nullable(),
    lines: z.array(itemLine),
    upgrade: z.number().int().min(0).max(20),
    seed: z.number().int(),
    setId: z.string().optional(),
  })
  .strict();

const equipSlot = z.enum([
  'weapon',
  'offhand',
  'helmet',
  'chest',
  'gloves',
  'boots',
  'belt',
  'amulet',
  'ring',
  'talisman',
]);

const questBlock = {
  questIds: z.array(z.string()),
  questProgress: z.record(z.number()),
  questsClaimed: z.array(z.string()),
  statsAt: z.record(z.number()),
};

const shopState = z
  .object({
    stock: z.array(itemInstance.nullable()).nullable(),
    rerollUsed: z.boolean(),
  })
  .strict();

export const gameSaveSchema = z
  .object({
    version: z.literal(7),
    createdAt: isoDate,
    lastSeenAt: isoDate,
    worldSeed: z.string().min(8),
    rngState: z.record(rngStateTuple),
    hero: z
      .object({
        name: z.string().min(2).max(16),
        classId: z.enum(['warrior', 'scout', 'mage', 'assassin']),
        level: z.number().int().min(1),
        xp: z.number().min(0),
        gold: z.number().min(0),
        gems: z.number().min(0),
        scraps: z.number().min(0),
        dust: z.number().min(0),
        treats: z.number().min(0),
        honor: z.number(),
        attrsBought: z
          .object({
            str: z.number().int().min(0),
            dex: z.number().int().min(0),
            int: z.number().int().min(0),
            con: z.number().int().min(0),
            lck: z.number().int().min(0),
          })
          .strict(),
        portrait: z.object({ icon: z.string(), palette: z.number().int().min(0) }).strict(),
        titleId: z.string().nullable(),
        potions: z.array(
          z.object({ elixirId: z.string(), attribute: attributeId, expiresAt: isoDate }).strict(),
        ),
      })
      .strict(),
    inventory: z
      .object({
        equipped: z.record(equipSlot, itemInstance),
        backpack: z.array(itemInstance),
        capacity: z.number().int().min(1),
      })
      .strict(),
    activities: z
      .object({
        mission: missionActivity.nullable(),
        expedition: expeditionState.nullable(),
        patrol: patrolActivity.nullable(),
        tavernOffers: z.array(missionOffer).length(3).nullable(),
        dungeonCooldowns: z.record(isoDate),
        arena: z
          .object({ fightsToday: z.number().int().min(0), cooldownUntil: isoDate.nullable() })
          .strict(),
      })
      .strict(),
    daily: z
      .object({
        dayKey: z.string(),
        vigor: z.number().min(0),
        secondWindUsed: z.boolean(),
        aleUsed: z.number().int().min(0),
        wheelSpins: z.number().int().min(0),
        dismantles: z.number().int().min(0),
        expeditions: z.number().int().min(0),
        tavernRerollUsed: z.boolean(),
        freeTossUsed: z.boolean(),
        activity: z.number().min(0),
        questSwapUsed: z.boolean(),
        activityChestClaimed: z.boolean(),
        ...questBlock,
      })
      .strict(),
    weekly: z.object({ weekKey: z.string(), ...questBlock }).strict(),
    monthly: z.object({ monthKey: z.string(), ...questBlock }).strict(),
    calendar: z
      .object({
        monthKey: z.string(),
        claimedDays: z.array(z.number().int().min(1).max(28)),
        lastClaimDayKey: z.string().nullable(),
      })
      .strict(),
    progress: z
      .object({
        story: z.record(z.number().int().min(0).max(5)),
        zonesUnlocked: z.number().int().min(1),
        zonePinned: z.number().int().nullable(),
        dungeonFloors: z.record(z.number().int().min(0)),
        codex: z
          .object({
            monstersSeen: z.record(z.number().int().min(0)),
            itemsSeen: z.record(z.literal(true)),
            loreSeen: z.record(z.literal(true)),
          })
          .strict(),
        achievements: z.record(z.number().int().min(0)),
        titles: z.array(z.string()),
        frames: z.array(z.string()),
        pets: z.record(z.object({ owned: z.boolean(), level: z.number().int().min(0) }).strict()),
        equippedPet: z.string().nullable(),
        mountTier: z.number().int().min(0).max(4),
        gachaPity: z.record(
          z
            .object({ sinceEpic: z.number().int().min(0), sinceSet: z.number().int().min(0) })
            .strict(),
        ),
        milestonesClaimed: z.array(z.string()),
        onboarding: z
          .object({ step: z.number().int().min(0), skipped: z.boolean() })
          .strict(),
        toursSeen: z.array(z.string()),
      })
      .strict(),
    town: z
      .object({
        shops: z
          .object({
            weaponsmith: shopState,
            armorer: shopState,
            arcanum: shopState,
          })
          .strict(),
      })
      .strict(),
    stats: z.record(z.number()),
  })
  .strict();

export function parseGameSave(raw: unknown): GameSave {
  return gameSaveSchema.parse(raw) as GameSave;
}
