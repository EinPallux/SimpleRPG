/**
 * The living ladder illusion (GAME_DESIGN.md §8.3, TECHNICAL_ARCHITECTURE §7).
 * All 750 "players" derive purely from (worldSeed, dayIndex) — nothing stored,
 * day 400 costs the same as day 1. Bots join over the world's first weeks,
 * progress by archetype with weekend bumps and noise, occasionally rage-quit
 * and get replaced by fresh joiners. Uses throwaway seeded rngs — never the
 * save's persisted streams (inspecting the ladder must not advance anything).
 */
import {
  FANTASY_FIRST,
  FANTASY_LAST,
  GAMER_CORES,
  GUILD_TAGS,
  leetify,
  RP_ADJECTIVES,
} from '@/content/botNames';
import { EMBLEM_ICONS, EMBLEM_PALETTES } from '@/content/emblems';
import {
  BOT_COUNT,
  BOT_DAILY_EQUIV,
  BOT_HONOR_COEF,
  BOT_HONOR_EXP,
  BOT_QUIT_CHANCE_PER_MONTH,
  BOT_WEEKEND_MULT,
  HONOR_START,
  MPL_BASE,
  MPL_DIV,
  WORLD_AGE_DAYS,
} from './constants';
import type { Combatant } from './combat';
import { classSignature } from './combatants';
import { rollDrop, slotOf } from './items';
import { parArmor, parCon, parMainAttr, parOffAttr } from './par';
import { Rng, seedState } from './rng';
import { getClass } from '@/content/classes';
import type { ClassId, EmblemSpec, EquipSlot, GameSave, ItemInstance } from './types';

export type BotArchetype = 'nolifer' | 'dedicated' | 'regular' | 'casual' | 'dormant';

export interface BotIdentity {
  id: number;
  name: string;
  guildTag: string | null;
  classId: ClassId;
  emblem: EmblemSpec;
  archetype: BotArchetype;
  joinDay: number; // world-day the bot joined (generation 0: 0..WORLD_AGE)
  affinity: number; // arena keenness 0.7–1.3, scales honor
  generation: number; // >0 = successor of a rage-quitter
}

export interface BotSnapshot extends BotIdentity {
  level: number;
  honor: number;
}

export interface LadderRow {
  rank: number;
  bot: BotSnapshot | null; // null = the player's row
  honor: number;
}

const CLASSES: readonly ClassId[] = ['warrior', 'scout', 'mage', 'assassin'];

// ---------------------------------------------------------------------------
// Identity generation (per bot slot + generation, deterministic)
// ---------------------------------------------------------------------------

function makeName(rng: Rng): string {
  const style = rng.next();
  if (style < 0.45) {
    const name = rng.pick(FANTASY_FIRST) + rng.pick(FANTASY_LAST);
    return rng.chance(0.15) ? name + rng.int(1, 99) : name;
  }
  if (style < 0.85) {
    const core = rng.pick(GAMER_CORES);
    const pattern = rng.int(0, 4);
    let name =
      pattern === 0
        ? `Xx${core}xX`
        : pattern === 1
          ? `${core}${rng.int(11, 9999)}`
          : pattern === 2
            ? `${core}_${rng.pick(GAMER_CORES)}`
            : pattern === 3
              ? `The${core}`
              : `${core}HD`;
    if (rng.chance(0.08)) name = leetify(name);
    if (rng.chance(0.2)) name = name.toLowerCase();
    return name;
  }
  return `${rng.pick(FANTASY_FIRST)}${rng.pick(FANTASY_LAST)} the ${rng.pick(RP_ADJECTIVES)}`;
}

function archetypeFor(roll: number): BotArchetype {
  // BOT_ARCHETYPE_DIST percentages, cumulative
  if (roll < 0.04) return 'nolifer';
  if (roll < 0.25) return 'dedicated';
  if (roll < 0.7) return 'regular';
  if (roll < 0.92) return 'casual';
  return 'dormant';
}

export function botIdentity(worldSeed: string, slot: number, generation: number): BotIdentity {
  const rng = new Rng(seedState(worldSeed, `bot|${slot}|${generation}`));
  const archetype = archetypeFor(rng.next());
  return {
    id: slot,
    name: makeName(rng),
    guildTag: rng.chance(0.55) ? rng.pick(GUILD_TAGS) : null,
    classId: rng.pick(CLASSES),
    emblem: { icon: rng.pick(EMBLEM_ICONS), palette: rng.int(0, EMBLEM_PALETTES.length - 1) },
    archetype,
    // generation 0 joins during the world's pre-history; successors join at their swap day
    joinDay: generation === 0 ? Math.floor(Math.pow(rng.next(), 1.4) * WORLD_AGE_DAYS) : 0,
    affinity: 0.7 + rng.next() * 0.6,
    generation,
  };
}

/** Which generation of this slot is alive on `dayIndex`, and when it joined. */
function aliveGeneration(
  worldSeed: string,
  slot: number,
  dayIndex: number,
): { generation: number; joinDay: number } {
  let generation = 0;
  let joinDay = botIdentity(worldSeed, slot, 0).joinDay;
  // Rage-quits: check month by month with a per-(slot,generation,month) roll.
  for (let guard = 0; guard < 24; guard++) {
    const rng = new Rng(seedState(worldSeed, `quit|${slot}|${generation}`));
    // This generation's lifetime in days (geometric by month, capped at 2 years)
    let lifetime = Infinity;
    for (let month = 1; month <= 24; month++) {
      if (rng.chance(BOT_QUIT_CHANCE_PER_MONTH)) {
        lifetime = month * 30;
        break;
      }
    }
    if (lifetime === Infinity || joinDay + lifetime > dayIndex) return { generation, joinDay };
    joinDay = joinDay + lifetime;
    generation += 1;
  }
  return { generation, joinDay };
}

// ---------------------------------------------------------------------------
// Progression curves
// ---------------------------------------------------------------------------

/** Invert cumulative MPL: equivalents E → continuous level (see BALANCING §2.2). */
export function levelFromEquivalents(equiv: number): number {
  // Σ_{l=1..n} MPL(l) ≈ MPL_BASE × (MPL_DIV/3) × ((1 + n/MPL_DIV)^3 − 1)
  const k = (MPL_BASE * MPL_DIV) / 3;
  const n = MPL_DIV * (Math.cbrt(equiv / k + 1) - 1);
  return Math.max(1, Math.floor(n) + 1);
}

/** Cumulative mission-equivalents a bot has earned by dayIndex. */
function botEquivalents(identity: BotIdentity, worldSeed: string, dayIndex: number): number {
  const days = Math.max(0, dayIndex - identity.joinDay);
  if (days === 0) return 0;
  const base = BOT_DAILY_EQUIV[identity.archetype];
  const fullWeeks = Math.floor(days / 7);
  // Weekly average: 5 weekdays + 2 weekend days at the bump.
  const weekAvg = base * (5 + 2 * BOT_WEEKEND_MULT);
  let total = fullWeeks * weekAvg + (days % 7) * base;
  // Per-bot fortnightly noise streaks (vacations, binges) — deterministic.
  const noise = new Rng(seedState(worldSeed, `noise|${identity.id}|${identity.generation}`));
  const fortnights = Math.floor(days / 14);
  for (let f = 0; f < fortnights; f++) {
    const streak = noise.next();
    if (streak < 0.12) total -= base * 7; // a lazy week
    else if (streak > 0.9) total += base * 5; // a binge
  }
  return Math.max(0, total);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** World-day for a save at a wall-clock instant (creation day = WORLD_AGE_DAYS). */
export function worldDayIndex(save: GameSave, nowMs: number): number {
  const created = new Date(Date.parse(save.createdAt));
  const createdMidnight = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate(),
  ).getTime();
  const elapsedDays = Math.max(0, Math.floor((nowMs - createdMidnight) / 86_400_000));
  return WORLD_AGE_DAYS + elapsedDays;
}

export function botSnapshot(worldSeed: string, slot: number, dayIndex: number): BotSnapshot {
  const alive = aliveGeneration(worldSeed, slot, dayIndex);
  const identity = { ...botIdentity(worldSeed, slot, alive.generation), joinDay: alive.joinDay };
  const equiv = botEquivalents(identity, worldSeed, dayIndex);
  const levelEquiv = MPL_DIV * (Math.cbrt(equiv / ((MPL_BASE * MPL_DIV) / 3) + 1) - 1);
  const level = levelFromEquivalents(equiv);
  const honor = Math.max(
    HONOR_START,
    Math.round(BOT_HONOR_COEF * Math.pow(Math.max(1, levelEquiv), BOT_HONOR_EXP) * identity.affinity),
  );
  return { ...identity, level, honor };
}

const ladderCache = new Map<string, BotSnapshot[]>();

/** All bots on a given world day, sorted by honor descending. Memoized. */
export function botLadder(worldSeed: string, dayIndex: number): BotSnapshot[] {
  const key = `${worldSeed}|${dayIndex}`;
  const cached = ladderCache.get(key);
  if (cached) return cached;
  const bots: BotSnapshot[] = [];
  const seen = new Set<string>();
  for (let slot = 0; slot < BOT_COUNT; slot++) {
    const bot = botSnapshot(worldSeed, slot, dayIndex);
    // CONTENT_CATALOG §12 collision rule: append digits (deterministic by slot).
    if (seen.has(bot.name)) bot.name = `${bot.name}${(slot % 89) + 11}`;
    seen.add(bot.name);
    bots.push(bot);
  }
  bots.sort((a, b) => b.honor - a.honor || a.id - b.id);
  if (ladderCache.size > 8) ladderCache.clear(); // tiny LRU-ish guard
  ladderCache.set(key, bots);
  return bots;
}

/** Full ladder with the player's row spliced in by honor. */
export function ladderWithPlayer(save: GameSave, nowMs: number): LadderRow[] {
  const dayIndex = worldDayIndex(save, nowMs);
  const bots = botLadder(save.worldSeed, dayIndex);
  const rows: LadderRow[] = [];
  let inserted = false;
  for (const bot of bots) {
    if (!inserted && save.hero.honor >= bot.honor) {
      rows.push({ rank: rows.length + 1, bot: null, honor: save.hero.honor });
      inserted = true;
    }
    rows.push({ rank: rows.length + 1, bot, honor: bot.honor });
  }
  if (!inserted) rows.push({ rank: rows.length + 1, bot: null, honor: save.hero.honor });
  return rows;
}

export function playerRank(save: GameSave, nowMs: number): number {
  const dayIndex = worldDayIndex(save, nowMs);
  const bots = botLadder(save.worldSeed, dayIndex);
  let above = 0;
  for (const bot of bots) if (bot.honor > save.hero.honor) above++;
  return above + 1;
}

const GEAR_ORDER: readonly EquipSlot[] = [
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
];

/**
 * Display-only gear snapshot for profile peeks (GAME_DESIGN §8.3: derived per
 * (botId, level band) — inspecting twice shows the same kit). Higher-level bots
 * show fuller wardrobes; the pieces never enter any inventory.
 */
export function botDisplayGear(bot: BotSnapshot, worldSeed: string): ItemInstance[] {
  const band = Math.floor(bot.level / 5);
  const rng = new Rng(seedState(worldSeed, `gear|${bot.id}|${bot.generation}|${band}`));
  const pieces = Math.min(8, 2 + Math.floor(bot.level / 8));
  const bySlot = new Map<EquipSlot, ItemInstance>();
  for (let roll = 0; roll < 24 && bySlot.size < pieces; roll++) {
    const item = rollDrop('mission', bot.level, bot.classId, rng);
    const slot = slotOf(item);
    if (!bySlot.has(slot)) bySlot.set(slot, item);
  }
  return GEAR_ORDER.filter((slot) => bySlot.has(slot)).map((slot) => bySlot.get(slot)!);
}

/** A bot's fighting kit — par-based, stable per (bot, 5-level band). */
export function botCombatant(bot: BotSnapshot, worldSeed: string): Combatant {
  const band = Math.floor(bot.level / 5);
  const rng = new Rng(seedState(worldSeed, `kit|${bot.id}|${bot.generation}|${band}`));
  const cls = getClass(bot.classId);
  const sig = classSignature(bot.classId);
  const variance = () => 0.88 + rng.next() * 0.24; // ±12%

  const main = Math.round(parMainAttr(bot.level) * variance());
  const off = Math.round(parOffAttr(bot.level) * variance());
  const con = Math.round(parCon(bot.level) * variance());
  const lck = Math.round(parOffAttr(bot.level) * 0.9 * variance());
  const attrs = { str: off, dex: off, int: off, con, lck };
  attrs[cls.mainAttr] = main;

  const mid = (3 + 2.2 * bot.level) * variance();
  const weapon = { min: Math.max(1, Math.round(mid * 0.85)), max: Math.round(mid * 1.15) };

  return {
    id: `bot-${bot.id}`,
    name: bot.name,
    level: bot.level,
    mainAttr: cls.mainAttr,
    attrs,
    maxHp: Math.round(con * cls.hpFactor * (bot.level + 1)),
    armor: Math.round(parArmor(bot.level) * cls.armorMult * variance()),
    weapon,
    ...(bot.classId === 'assassin' ? { offhandWeapon: weapon } : {}),
    blockChance: sig.blockChance,
    evadeChance: sig.evadeChance,
    unblockable: sig.unblockable,
    strikes: sig.strikes,
    strikeMult: sig.strikeMult,
    dmgMult: sig.dmgMult,
    critCap: sig.critCap,
    critMult: sig.critMult,
  };
}
