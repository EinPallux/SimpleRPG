/**
 * Collectible contracts (M7): pets, mounts and the Wishing Well's banners.
 * Data lives in `pets.ts` / `mounts.ts` / `gacha.ts`; the engine reads it.
 *
 * Pet auras are declarative effects so `engine/pets.ts` can fold them into the
 * same derived-stat pipeline that gear and set bonuses already use — a pet
 * never needs a special case anywhere else in the game.
 */
import { z } from 'zod';
import type { AttributeId } from '@/engine/types';

// ---------------------------------------------------------------------------
// Pets (GAME_DESIGN §11.1, CONTENT §6.3)
// ---------------------------------------------------------------------------

export type PetFamily = 'beast' | 'elemental' | 'spirit' | 'cryptid';
/** Common / Rare / Epic / Legendary — drives treat costs and aura strength. */
export type PetRarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * One aura line. `value` is the effect at pet level 1; it scales to
 * PET_AURA_MAX_MULT× at level 50 (engine/pets.ts).
 * Percent effects carry fractions (0.05 = +5%); `pp` effects are percentage
 * points added to a chance.
 */
export type PetAura =
  | { kind: 'attrPct'; attr: AttributeId | 'all'; value: number }
  | { kind: 'goldFind'; value: number }
  | { kind: 'xp'; value: number }
  | { kind: 'critDmg'; value: number }
  | { kind: 'armorPct'; value: number }
  | { kind: 'hpPct'; value: number }
  | { kind: 'evadePP'; value: number }
  | { kind: 'itemChancePP'; value: number }
  | { kind: 'missionSpeed'; value: number }
  | { kind: 'treatFind'; value: number }
  | { kind: 'shopDiscount'; value: number }
  | { kind: 'arenaGold'; value: number }
  | { kind: 'honorGain'; value: number }
  | { kind: 'dungeonLuck'; value: number };

/** Where a pet comes from — the Menagerie shows this on undiscovered slots. */
export type PetSource =
  | { kind: 'story'; chapter: number }
  | { kind: 'zone'; zoneIndex: number; chance: number }
  | { kind: 'dungeon'; dungeonId: string }
  | { kind: 'achievement'; achievementId: string }
  | { kind: 'well'; phase: 'A' | 'B' }
  | { kind: 'wheel' };

export interface PetDef {
  id: string;
  family: PetFamily;
  rarity: PetRarity;
  /** the headline bonus */
  major: PetAura;
  /** the smaller companion bonus */
  minor: PetAura;
  source: PetSource;
  /**
   * The i18n BASE key (`pet.{id}`) — not a resolvable key on its own. Use
   * `petNameKey(id)` / `petBlurbKey(id)`, which append `.name` and `.blurb`.
   */
  nameKey: string;
}

const auraSchema = z
  .object({
    kind: z.enum([
      'attrPct',
      'goldFind',
      'xp',
      'critDmg',
      'armorPct',
      'hpPct',
      'evadePP',
      'itemChancePP',
      'missionSpeed',
      'treatFind',
      'shopDiscount',
      'arenaGold',
      'honorGain',
      'dungeonLuck',
    ]),
    value: z.number().positive(),
    attr: z.enum(['str', 'dex', 'int', 'con', 'lck', 'all']).optional(),
  })
  .strict();

export const petSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    family: z.enum(['beast', 'elemental', 'spirit', 'cryptid']),
    rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
    major: auraSchema,
    minor: auraSchema,
    source: z.object({ kind: z.string() }).passthrough(),
    nameKey: z.string(),
  })
  .strict();

/** Pets level 1→50 on treats; the aura reaches this multiple at 50. */
export const PET_MAX_LEVEL = 50;
export const PET_AURA_MAX_MULT = 3;
/** Each DISTINCT pet owned grants +0.5% all attributes, capped at +8% (§11.1). */
export const PET_COLLECTION_PCT = 0.005;
export const PET_COLLECTION_CAP = 0.08;

// ---------------------------------------------------------------------------
// Mounts (GAME_DESIGN §11.2, CONTENT §6.4)
// ---------------------------------------------------------------------------

export interface MountDef {
  id: string;
  /** 1..4 — matches the index into MOUNT_SPEED (tier 0 = on foot) */
  tier: number;
  /** mission-duration reduction as a fraction */
  speed: number;
  costGold?: number;
  costGems?: number;
  /** the little cosmetic title each mount carries */
  titleId: string;
  /** i18n `mount.{id}.name` + `mount.{id}.blurb` */
  nameKey: string;
}

export const mountSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    tier: z.number().int().min(1).max(4),
    speed: z.number().positive().max(0.9),
    costGold: z.number().positive().optional(),
    costGems: z.number().positive().optional(),
    titleId: z.string(),
    nameKey: z.string(),
  })
  .strict();

// ---------------------------------------------------------------------------
// The Wishing Well (GAME_DESIGN §10, odds BALANCING §7, rotation CONTENT §7)
// ---------------------------------------------------------------------------

export type BannerId = 'standard' | 'featured' | 'pet';

/**
 * One row of the always-visible odds table (BALANCING §7).
 *
 * There is deliberately no `frame` member: a cosmetic portrait frame is a
 * sub-roll *inside* the consumable outcome (§7, "from consumable slot, 3%"),
 * so these six stay a clean distribution summing to 100 and the roll needs no
 * seventh branch. See `gacha.ts` `CONSUMABLE_FRAME_PP`.
 */
export type TossOutcomeKind = 'consumable' | 'rare' | 'epic' | 'setPiece' | 'petEgg' | 'legendary';

export interface BannerDef {
  id: BannerId;
  /** odds in percent, summing to 100 */
  odds: Record<TossOutcomeKind, number>;
  /** i18n `banner.{id}.name` + `banner.{id}.blurb` */
  nameKey: string;
}

export const bannerSchema = z
  .object({
    id: z.enum(['standard', 'featured', 'pet']),
    odds: z.record(z.number()),
    nameKey: z.string(),
  })
  .strict();

/**
 * A cosmetic portrait frame — the only thing the Well hands out that carries no
 * stats at all, which is exactly why it can be the rarest-feeling prize without
 * touching the balance model.
 */
export interface FrameDef {
  id: string;
  /** null = general pool; otherwise the featured set this frame ships with */
  setId: string | null;
  /** i18n `frame.{id}` */
  nameKey: string;
}

export const frameSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    setId: z.string().nullable(),
    nameKey: z.string(),
  })
  .strict();

/** Pity, persisted per banner type (§10): Epic+ every 10, a set piece at 30. */
export const PITY_EPIC_EVERY = 10;
export const PITY_SET_AT = 30;
/** On the Featured banner, this share of set-piece hits are the featured set. */
export const FEATURED_SET_SHARE = 0.75;
/** Pet banner: this share of egg hits are the phase's focus pet. */
export const BANNER_PET_SHARE = 0.5;
