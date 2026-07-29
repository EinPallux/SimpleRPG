/**
 * The Wishing Well (GAME_DESIGN.md §10, odds BALANCING.md §7).
 *
 * The ethical-gacha promises this module has to keep, in order of how much they
 * constrain the code:
 *
 *  1. **No money, ever** (invariant 1). Gems are earned; there is no purchase
 *     path to add and none to accidentally leave a hook for.
 *  2. **Odds on screen.** `content/gacha.ts` owns the table and the UI renders
 *     that same table — the roll below bisects it rather than hard-coding any
 *     number, so the printed odds cannot drift from the real ones.
 *  3. **Pity is real and visible.** Counters live in the save (per banner) and
 *     are returned on every toss so the screen can show them without guessing.
 *  4. **Nothing is wasted.** A set piece you can't use or a pet you already own
 *     converts to dust or treats instead of evaporating.
 *
 * Every roll comes off the persisted `gacha` stream, so a toss cannot be
 * save-scummed by reloading, and the simulator replays a player's exact luck.
 */
import {
  BANNER_PET_SHARE,
  FEATURED_SET_SHARE,
  PITY_EPIC_EVERY,
  PITY_SET_AT,
} from '@/content/collectibles';
import {
  CONSUMABLE_FRAME_PP,
  FRAME_BANNERS,
  FRAMES,
  featuredSetForHero,
  frameForSet,
  getBanner,
  OUTCOME_ORDER,
  petPhaseForWeek,
  type BannerId,
  type TossOutcomeKind,
} from '@/content/gacha';
import { PETS, wellExclusives } from '@/content/pets';
import { getSet, SETS } from '@/content/sets';
import {
  DUPE_LEGENDARY_DUST,
  DUPE_PET_TREATS,
  DUPE_SET_DUST,
  TOSS_COST_GEMS,
  TOSS_TEN_COST_GEMS,
  TOSS_TEN_COUNT,
  WELL_BUNDLE_ELIXIR_CHANCE,
  WELL_GEAR_ILVL_BONUS,
  WELL_LEGENDARY_ILVL_BONUS,
  WELL_BUNDLE_GOLD,
  WELL_BUNDLE_SCRAPS,
  WELL_BUNDLE_TREATS,
  WELL_UNLOCK_LEVEL,
} from './constants';
import { missionGold } from './economy';
import { generateItem, generateUnique, sellPrice } from './items';
import { rollUnique } from './uniques';
import { bump, recordDrop } from './ledger';
import { grantPet, petOwned } from './pets';
import { grantFrame, grantReward } from './rewards';
import { getStream, type Rng } from './rng';
import { ownsFullSet, rollSetPiece } from './sets';
import type { ActivePotion, GameSave, ItemInstance } from './types';

export function wellUnlocked(save: GameSave): boolean {
  return save.hero.level >= WELL_UNLOCK_LEVEL;
}

/** The free daily toss is Standard-only (§10) — it teaches the system. */
export function freeTossAvailable(save: GameSave, bannerId: BannerId): boolean {
  return wellUnlocked(save) && bannerId === 'standard' && !save.daily.freeTossUsed;
}

/**
 * Gem cost of tossing `count` times, after the free daily toss is applied.
 * The 10-toss is priced as nine (§10: the tenth is the discount), so a free
 * toss inside a 10-pull reduces it by one single-toss price, never more.
 */
export function tossCost(save: GameSave, bannerId: BannerId, count: number): number {
  const free = freeTossAvailable(save, bannerId) ? 1 : 0;
  if (count === TOSS_TEN_COUNT) {
    return Math.max(0, TOSS_TEN_COST_GEMS - free * TOSS_COST_GEMS);
  }
  return Math.max(0, count - free) * TOSS_COST_GEMS;
}

export function canToss(save: GameSave, bannerId: BannerId, count = 1): boolean {
  if (!wellUnlocked(save)) return false;
  if (count !== 1 && count !== TOSS_TEN_COUNT) return false;
  return save.hero.gems >= tossCost(save, bannerId, count);
}

// ---------------------------------------------------------------------------
// Pity
// ---------------------------------------------------------------------------

export interface PityState {
  sinceEpic: number;
  sinceSet: number;
}

/**
 * The MUTABLE pity record for a banner, created on first use.
 *
 * Only the roll may call this. Everything that merely wants to *look* at the
 * counters must use {@link pityRemaining}, which is a pure read: the store
 * hands screens a deep-frozen save, so a lazy write during render throws.
 */
function pityFor(save: GameSave, bannerId: BannerId): PityState {
  const existing = save.progress.gachaPity[bannerId];
  if (existing) return existing;
  const fresh: PityState = { sinceEpic: 0, sinceSet: 0 };
  save.progress.gachaPity[bannerId] = fresh;
  return fresh;
}

/** A banner's counters, without creating them — safe on a frozen save. */
export function pityState(save: GameSave, bannerId: BannerId): PityState {
  return save.progress.gachaPity[bannerId] ?? { sinceEpic: 0, sinceSet: 0 };
}

/** Tosses left before each guarantee — what the always-on UI counter shows. */
export function pityRemaining(
  save: GameSave,
  bannerId: BannerId,
): { toEpic: number; toSet: number } {
  const pity = pityState(save, bannerId);
  return {
    toEpic: Math.max(0, PITY_EPIC_EVERY - pity.sinceEpic),
    toSet: Math.max(0, PITY_SET_AT - pity.sinceSet),
  };
}

/** Epic+ for pity purposes: epic gear, a set piece, or a legendary. */
function isEpicPlus(kind: TossOutcomeKind): boolean {
  return kind === 'epic' || kind === 'setPiece' || kind === 'legendary';
}

// ---------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------

/** Bisect the printed odds column with one roll — see promise 2 above. */
function rollKind(rng: Rng, bannerId: BannerId): TossOutcomeKind {
  const { odds } = getBanner(bannerId);
  const roll = rng.next() * 100;
  let running = 0;
  for (const kind of OUTCOME_ORDER) {
    running += odds[kind];
    if (roll < running) return kind;
  }
  return 'consumable';
}

export interface TossResult {
  bannerId: BannerId;
  kind: TossOutcomeKind;
  /** which guarantee (if any) overrode the natural roll */
  pity: 'epic' | 'set' | null;
  item: ItemInstance | null;
  /** set id when `kind === 'setPiece'`, even if the piece duped to dust */
  setId: string | null;
  petId: string | null;
  frameId: string | null;
  /** the prize was already owned and converted (dust / treats) */
  dupe: boolean;
  gold: number;
  scraps: number;
  treats: number;
  dust: number;
  /** paid instead of an item when the backpack was full */
  autoSoldGold: number;
  /** the bundle's potion (§7), when it carried one */
  potion: ActivePotion | null;
  /** pity counters AFTER this toss, for the on-screen display */
  pityAfter: PityState;
}

function emptyResult(bannerId: BannerId, kind: TossOutcomeKind): TossResult {
  return {
    bannerId,
    kind,
    pity: null,
    item: null,
    setId: null,
    petId: null,
    frameId: null,
    dupe: false,
    gold: 0,
    scraps: 0,
    treats: 0,
    dust: 0,
    autoSoldGold: 0,
    potion: null,
    pityAfter: { sinceEpic: 0, sinceSet: 0 },
  };
}

/** Sets the hero could plausibly wear — the same eligibility rewards.ts uses. */
function eligibleSetIds(save: GameSave): string[] {
  const ids = SETS.filter(
    (s) =>
      (s.classId === null || s.classId === save.hero.classId) && s.level <= save.hero.level + 5,
  ).map((s) => s.id);
  return ids.length > 0 ? ids : ['innkeepers-regalia'];
}

/**
 * Which set a set-piece hit belongs to. On the Featured banner three in four go
 * to the week's rate-up set (§7), and a pity-forced hit is always the featured
 * one — the guarantee would be hollow otherwise.
 */
function pickSetId(
  save: GameSave,
  bannerId: BannerId,
  weekNumber: number,
  forced: boolean,
  rng: Rng,
): string {
  if (bannerId === 'featured') {
    const featured = featuredSetForHero(weekNumber, save.hero.level);
    if (forced || rng.chance(FEATURED_SET_SHARE)) return featured;
  }
  return rng.pick(eligibleSetIds(save));
}

/**
 * Which pet an egg hatches. The well is the *luck* path to the same menagerie
 * the zones and dungeons stock, so any un-owned pet can appear; the pet banner
 * simply weights half its eggs toward the phase's exclusive (§7).
 */
function pickPetId(save: GameSave, bannerId: BannerId, weekNumber: number, rng: Rng): string {
  if (bannerId === 'pet') {
    const focus = wellExclusives(petPhaseForWeek(weekNumber))[0];
    if (focus && !petOwned(save, focus.id) && rng.chance(BANNER_PET_SHARE)) return focus.id;
  }
  const unowned = PETS.filter((pet) => !petOwned(save, pet.id));
  // Everything already adopted: the egg still hatches, and dupes into treats.
  return rng.pick(unowned.length > 0 ? unowned : PETS).id;
}

/**
 * A cosmetic frame from the banner's pool: the featured set's own frame when it
 * has one, otherwise anything not yet framed. Frames carry no stats at all,
 * which is exactly why they can be the rarest-feeling prize here.
 */
function pickFrameId(save: GameSave, bannerId: BannerId, weekNumber: number, rng: Rng): string {
  const pool: string[] = [];
  if (bannerId === 'featured') {
    const own = frameForSet(featuredSetForHero(weekNumber, save.hero.level));
    if (own && !save.progress.frames.includes(own.id)) return own.id;
  }
  for (const frame of FRAMES) {
    if (!save.progress.frames.includes(frame.id)) pool.push(frame.id);
  }
  return rng.pick(pool.length > 0 ? pool : FRAMES.map((f) => f.id));
}

function stow(save: GameSave, item: ItemInstance, result: TossResult): void {
  recordDrop(save, item);
  result.item = item;
  if (save.inventory.backpack.length < save.inventory.capacity) {
    save.inventory.backpack.push(item);
  } else {
    result.autoSoldGold = sellPrice(item);
    save.hero.gold += result.autoSoldGold;
    bump(save, 'goldEarned', result.autoSoldGold);
  }
}

/**
 * One toss. `weekNumber` is the ISO week (engine/time.ts `isoWeekNumber`) and
 * `nowMs` dates any elixir the bundle pays out — the engine never reads the
 * clock itself (invariant 4), so both are passed in.
 */
function tossOnce(
  save: GameSave,
  bannerId: BannerId,
  weekNumber: number,
  nowMs: number,
  rng: Rng,
): TossResult {
  const pity = pityFor(save, bannerId);

  // Guarantees are evaluated on the toss that REACHES the threshold, so a
  // "30 to set" counter pays out on the 30th toss, not the 31st.
  const forceSet = pity.sinceSet + 1 >= PITY_SET_AT;
  const forceEpic = !forceSet && pity.sinceEpic + 1 >= PITY_EPIC_EVERY;

  const natural = rollKind(rng, bannerId);
  let kind = natural;
  let pityKind: 'epic' | 'set' | null = null;
  if (forceSet) {
    kind = 'setPiece';
    pityKind = natural === 'setPiece' ? null : 'set';
  } else if (forceEpic && !isEpicPlus(natural)) {
    kind = 'epic';
    pityKind = 'epic';
  }

  const result = emptyResult(bannerId, kind);
  result.pity = pityKind;
  if (pityKind !== null) bump(save, 'gachaPityHits');

  const level = save.hero.level;
  const m10 = missionGold(level, 10);

  if (kind === 'consumable') {
    // The frame sub-roll lives inside this slot (BALANCING §7).
    const framePct = FRAME_BANNERS.includes(bannerId) ? CONSUMABLE_FRAME_PP : 0;
    const slot = getBanner(bannerId).odds.consumable;
    if (framePct > 0 && rng.chance(framePct / slot)) {
      const frameId = pickFrameId(save, bannerId, weekNumber, rng);
      if (grantFrame(save, frameId)) {
        result.frameId = frameId;
      } else {
        // Every frame already hung on the wall — pay the bundle instead. Still
        // a dupe conversion, so it belongs in the same ledger counter as the
        // set and pet conversions below.
        result.dupe = true;
        bump(save, 'gachaDupes');
      }
    }
    if (result.frameId === null) {
      result.gold = Math.round(m10 * WELL_BUNDLE_GOLD);
      result.scraps = WELL_BUNDLE_SCRAPS;
      result.treats = WELL_BUNDLE_TREATS;
      save.hero.gold += result.gold;
      save.hero.scraps += result.scraps;
      save.hero.treats += result.treats;
      bump(save, 'goldEarned', result.gold);
      // The bundle's fourth face (§7): a day of elixir. Rolled here rather than
      // as its own outcome so the printed odds column stays the six §7 slots.
      if (rng.chance(WELL_BUNDLE_ELIXIR_CHANCE)) {
        result.potion = grantReward(save, { elixir: true }, nowMs).potion;
      }
    }
  } else if (kind === 'rare' || kind === 'epic') {
    stow(
      save,
      generateItem(
        { ilvl: level + WELL_GEAR_ILVL_BONUS, rarity: kind, biasClass: save.hero.classId },
        rng,
      ),
      result,
    );
  } else if (kind === 'legendary') {
    // The 1% row is the well's headline, so it is also a real path to the eight
    // named legendaries rather than always a generated one (CONTENT §6.2).
    const namedId = rollUnique(save, rng);
    const ilvl = level + WELL_LEGENDARY_ILVL_BONUS;
    stow(
      save,
      namedId
        ? generateUnique(namedId, ilvl, rng)
        : generateItem({ ilvl, rarity: 'legendary', biasClass: save.hero.classId }, rng),
      result,
    );
  } else if (kind === 'setPiece') {
    const setId = pickSetId(save, bannerId, weekNumber, forceSet, rng);
    result.setId = setId;
    const complete = ownsFullSet(save, setId);
    const piece = rollSetPiece(save, setId, rng);
    if (complete) {
      // Dupe: codex credit is still recorded, the piece becomes dust (§7).
      recordDrop(save, piece);
      result.dupe = true;
      result.dust = getSet(setId).level >= 100 ? DUPE_LEGENDARY_DUST : DUPE_SET_DUST;
      save.hero.dust += result.dust;
      bump(save, 'gachaDupes');
    } else {
      stow(save, piece, result);
    }
  } else {
    // petEgg
    const petId = pickPetId(save, bannerId, weekNumber, rng);
    result.petId = petId;
    if (grantPet(save, petId)) {
      // adopted
    } else {
      result.dupe = true;
      result.treats = DUPE_PET_TREATS;
      save.hero.treats += result.treats;
      bump(save, 'gachaDupes');
    }
  }

  pity.sinceEpic = isEpicPlus(kind) ? 0 : pity.sinceEpic + 1;
  pity.sinceSet = kind === 'setPiece' ? 0 : pity.sinceSet + 1;
  result.pityAfter = { sinceEpic: pity.sinceEpic, sinceSet: pity.sinceSet };

  bump(save, 'gachaTosses');
  return result;
}

/**
 * Toss once or ten times. Charges up front (spending the free daily toss if it
 * is still there), then resolves each toss in order against the shared pity
 * counters — so a 10-pull can and does trip the Epic+ guarantee mid-way.
 */
export function toss(
  save: GameSave,
  bannerId: BannerId,
  weekNumber: number,
  count: number,
  nowMs: number,
): TossResult[] {
  if (!wellUnlocked(save)) throw new Error('The Wishing Well is not open yet');
  if (count !== 1 && count !== TOSS_TEN_COUNT) {
    throw new Error(`The well takes 1 or ${TOSS_TEN_COUNT} gems' worth, not ${count}`);
  }
  const cost = tossCost(save, bannerId, count);
  if (save.hero.gems < cost) throw new Error('Not enough gems');

  if (freeTossAvailable(save, bannerId)) save.daily.freeTossUsed = true;
  save.hero.gems -= cost;

  const rng = getStream(save.rngState, save.worldSeed, 'gacha');
  const results: TossResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(tossOnce(save, bannerId, weekNumber, nowMs, rng));
  }
  return results;
}
