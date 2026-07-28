/**
 * Zod mirror of GameSave (engine/types.ts) — the load/import gatekeeper.
 * Kept strict: unknown keys are a schema drift signal, not tolerated silently.
 */
import { z } from 'zod';
import type { GameSave } from '@/engine/types';

const attributeId = z.enum(['str', 'dex', 'int', 'con', 'lck']);
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid ISO date');

const timedActivity = z
  .object({ kind: z.string(), startedAt: isoDate, durationSec: z.number().nonnegative() })
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
    lines: z.array(itemLine),
    upgrade: z.number().int().min(0).max(20),
    seed: z.number().int(),
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
};

export const gameSaveSchema = z
  .object({
    version: z.literal(1),
    createdAt: isoDate,
    lastSeenAt: isoDate,
    worldSeed: z.string().min(8),
    rngState: z.record(z.unknown()),
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
        mission: timedActivity.nullable(),
        expedition: timedActivity.nullable(),
        patrol: timedActivity.nullable(),
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
        tavernRerollUsed: z.boolean(),
        freeTossUsed: z.boolean(),
        activity: z.number().min(0),
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
        storyStep: z.number().int().min(0),
        zonesUnlocked: z.number().int().min(1),
        zonePinned: z.number().int().nullable(),
        dungeonFloors: z.record(z.number().int().min(0)),
        codex: z
          .object({
            monstersSeen: z.record(z.number().int().min(0)),
            itemsSeen: z.record(z.literal(true)),
          })
          .strict(),
        achievements: z.record(z.number().int().min(0)),
        pets: z.record(z.object({ owned: z.boolean(), level: z.number().int().min(0) }).strict()),
        equippedPet: z.string().nullable(),
        mountTier: z.number().int().min(0).max(4),
        gachaPity: z.record(
          z
            .object({ sinceEpic: z.number().int().min(0), sinceSet: z.number().int().min(0) })
            .strict(),
        ),
        milestonesClaimed: z.array(z.string()),
      })
      .strict(),
    stats: z.record(z.number()),
  })
  .strict();

export function parseGameSave(raw: unknown): GameSave {
  return gameSaveSchema.parse(raw) as GameSave;
}
