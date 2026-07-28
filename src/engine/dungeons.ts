/**
 * Dungeons (GAME_DESIGN.md §15, numbers BALANCING §4/§4.6): five wings of ten
 * boss floors — free hourly attempts against deliberate stat walls. Each floor
 * is beaten exactly once; the wall cadence (bounce → grow → break through) is
 * the mid-game heartbeat, enforced by the `dungeon-walls` sim scenario.
 * M5 note: level-gated; story-chapter keys join in M6.
 */
import {
  floorLevel,
  getDungeon,
  dungeonSetForClass,
  type BossDef,
  type DungeonDef,
} from '@/content/dungeons';
import {
  DROP_WEIGHTS_CHEST,
  DUNGEON_BOSS_ARMOR_MULT,
  DUNGEON_BOSS_ATTR_BASE,
  DUNGEON_BOSS_ATTR_PER_FLOOR,
  DUNGEON_BOSS_HP_BASE,
  DUNGEON_BOSS_HP_PER_FLOOR,
  DUNGEON_CLEAR_GEMS,
  DUNGEON_COOLDOWN_MIN,
  DUNGEON_FLOOR_GEMS,
  DUNGEON_FLOOR_GOLD_MULT,
  DUNGEON_FLOOR_XP_MULT,
  DUNGEON_SET_FLOOR_GEMS,
  DR_CAP,
  DR_DIVISOR,
} from './constants';
import { simulateCombat, type Combatant, type CombatResult } from './combat';
import { heroToCombatant } from './combatants';
import { missionGold, missionXp } from './economy';
import { generateItem, sellPrice } from './items';
import { parArmor, parCon, parHp, parMainAttr, parOffAttr } from './par';
import { getStream } from './rng';
import { ownsFullSet, rollSetPiece } from './sets';
import type { AttributeId, GameSave, ItemInstance, Rarity } from './types';
import { applyXp, type XpResult } from './xpGain';

export interface DungeonStatus {
  def: DungeonDef;
  unlocked: boolean;
  /** floors beaten (0..10) */
  cleared: number;
  /** the floor the next attempt fights, or null when the wing is finished */
  nextFloor: number | null;
  nextBoss: BossDef | null;
  nextBossLevel: number | null;
  cooldownMs: number;
}

export function dungeonCleared(save: GameSave, dungeonId: string): number {
  return save.progress.dungeonFloors[dungeonId] ?? 0;
}

export function dungeonCooldownRemaining(save: GameSave, dungeonId: string, nowMs: number): number {
  const until = save.activities.dungeonCooldowns[dungeonId];
  if (!until) return 0;
  return Math.max(0, Date.parse(until) - nowMs);
}

export function dungeonStatus(save: GameSave, dungeonId: string, nowMs: number): DungeonStatus {
  const def = getDungeon(dungeonId);
  const cleared = dungeonCleared(save, dungeonId);
  const nextFloor = cleared >= 10 ? null : cleared + 1;
  return {
    def,
    unlocked: save.hero.level >= def.unlockLevel,
    cleared,
    nextFloor,
    nextBoss: nextFloor ? def.bosses[nextFloor - 1]! : null,
    nextBossLevel: nextFloor ? floorLevel(def, nextFloor) : null,
    cooldownMs: dungeonCooldownRemaining(save, dungeonId, nowMs),
  };
}

/** §4 boss template: par curves × floor multipliers, trait flags on top. */
export function bossCombatant(dungeonId: string, floor: number, displayName?: string): Combatant {
  const def = getDungeon(dungeonId);
  const boss = def.bosses[floor - 1];
  if (!boss) throw new Error(`No floor ${floor} in ${dungeonId}`);
  const level = floorLevel(def, floor);
  const mAttr = DUNGEON_BOSS_ATTR_BASE + DUNGEON_BOSS_ATTR_PER_FLOOR * floor;
  const mHp = DUNGEON_BOSS_HP_BASE + DUNGEON_BOSS_HP_PER_FLOOR * floor;

  const mainAttr: AttributeId =
    boss.trait === 'caster' ? 'int' : boss.trait === 'swift' ? 'dex' : 'str';
  const main = Math.round(parMainAttr(level) * mAttr);
  const off = parOffAttr(level);
  const attrs = { str: off, dex: off, int: off, con: parCon(level), lck: Math.round(off * 0.8) };
  attrs[mainAttr] = main;
  const mid = 3 + 2.2 * level;

  return {
    id: `boss-${boss.slug}`,
    name: displayName ?? boss.slug,
    level,
    mainAttr,
    attrs,
    maxHp: Math.round(parHp(level) * mHp),
    armor: Math.round(parArmor(level) * DUNGEON_BOSS_ARMOR_MULT),
    weapon: { min: Math.round(mid * 0.85), max: Math.round(mid * 1.15) },
    blockChance: 0,
    evadeChance: boss.trait === 'swift' ? 0.1 : 0,
    unblockable: boss.trait === 'caster',
    strikes: 1,
    strikeMult: 1,
    dmgMult: 1,
    critCap: 0.5,
    critMult: 2,
    ...(boss.trait === 'brute' ? { brute: true } : {}),
    ...(boss.trait === 'elite' ? { critBonus: 0.05 } : {}),
  };
}

export function canAttemptFloor(
  save: GameSave,
  dungeonId: string,
  nowMs: number,
): { ok: true } | { ok: false; reason: 'locked' | 'cleared' | 'cooldown' } {
  const status = dungeonStatus(save, dungeonId, nowMs);
  if (!status.unlocked) return { ok: false, reason: 'locked' };
  if (status.nextFloor === null) return { ok: false, reason: 'cleared' };
  if (status.cooldownMs > 0) return { ok: false, reason: 'cooldown' };
  return { ok: true };
}

/** Rarity floor for guaranteed drops: 1–4 Rare+, 6–9 Epic+ (§4.6). */
const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function floorDropRarity(floor: number, roll: Rarity): Rarity {
  const min: Rarity = floor >= 6 ? 'epic' : 'rare';
  return RARITY_ORDER.indexOf(roll) < RARITY_ORDER.indexOf(min) ? min : roll;
}

export interface WallHint {
  /** the boss's damage reduction against the hero (0..cap) */
  bossDr: number;
  /** how much of the boss's health survived (0..1) */
  bossHpLeftPct: number;
  rounds: number;
}

export interface DungeonOutcome {
  dungeonId: string;
  floor: number;
  result: CombatResult;
  boss: Combatant;
  heroCombatant: Combatant;
  won: boolean;
  gold: number;
  gems: number;
  xp: XpResult | null;
  drop: ItemInstance | null;
  setDrop: boolean;
  autoSoldGold: number;
  /** the wing is finished with this clear */
  dungeonCleared: boolean;
  /** on a loss: what the wall shrugged off (UI turns this into words) */
  wallHint: WallHint | null;
}

/** One free attempt at the next floor; win or lose, the hourglass turns. */
export function attemptFloor(
  save: GameSave,
  dungeonId: string,
  nowMs: number,
  bossDisplayName?: string,
): DungeonOutcome {
  const gate = canAttemptFloor(save, dungeonId, nowMs);
  if (!gate.ok) throw new Error(`Dungeon attempt refused: ${gate.reason}`);
  const def = getDungeon(dungeonId);
  const floor = dungeonCleared(save, dungeonId) + 1;

  const hero = heroToCombatant(save);
  const boss = bossCombatant(dungeonId, floor, bossDisplayName);
  const combatStream = getStream(save.rngState, save.worldSeed, 'combat');
  const result = simulateCombat(hero, boss, combatStream.deriveSeed());
  const won = result.winner === 0;

  save.activities.dungeonCooldowns[dungeonId] = new Date(
    nowMs + DUNGEON_COOLDOWN_MIN * 60_000,
  ).toISOString();

  let gold = 0;
  let gems = 0;
  let xp: XpResult | null = null;
  let drop: ItemInstance | null = null;
  let setDrop = false;
  let autoSoldGold = 0;
  let clearedWing = false;
  let wallHint: WallHint | null = null;

  if (won) {
    save.progress.dungeonFloors[dungeonId] = floor;
    clearedWing = floor === 10;
    gold = Math.round(missionGold(save.hero.level, 10) * DUNGEON_FLOOR_GOLD_MULT);
    gems = floor === 5 || floor === 10 ? DUNGEON_SET_FLOOR_GEMS : DUNGEON_FLOOR_GEMS;
    if (clearedWing) gems += DUNGEON_CLEAR_GEMS;

    const loot = getStream(save.rngState, save.worldSeed, 'loot');
    if (floor === 5 || floor === 10) {
      // The chase: a set piece from the wing's pool, dupe-protected; the
      // fixed-pool wings (D2/D4) pity into the class set once complete.
      setDrop = true;
      let setId = dungeonSetForClass(def, save.hero.classId);
      if (def.setPool.kind === 'fixed' && ownsFullSet(save, setId)) {
        const pityDef = getDungeon(dungeonId);
        const level = pityDef.setPool.kind === 'fixed' ? pityDef.setPool.pityClassLevel : 20;
        setId = dungeonSetForClass(
          { ...def, setPool: { kind: 'class', level } },
          save.hero.classId,
        );
      }
      drop = rollSetPiece(save, setId, loot);
    } else {
      const rolled = loot.weighted(
        DROP_WEIGHTS_CHEST.map(([r, w]) => [r as Rarity, w] as const),
      );
      drop = generateItem(
        {
          ilvl: floorLevel(def, floor),
          rarity: floorDropRarity(floor, rolled),
          biasClass: save.hero.classId,
        },
        loot,
      );
    }
    if (save.inventory.backpack.length < save.inventory.capacity) {
      save.inventory.backpack.push(drop);
    } else {
      autoSoldGold = sellPrice(drop);
    }

    save.hero.gold += gold + autoSoldGold;
    save.hero.gems += gems;
    save.stats.goldEarned = (save.stats.goldEarned ?? 0) + gold + autoSoldGold;
    save.stats.dungeonFloors = (save.stats.dungeonFloors ?? 0) + 1;
    xp = applyXp(save, Math.round(missionXp(save.hero.level, 10) * DUNGEON_FLOOR_XP_MULT));
  } else {
    save.stats.dungeonBounces = (save.stats.dungeonBounces ?? 0) + 1;
    wallHint = {
      bossDr: Math.min(DR_CAP, boss.armor / (hero.level * DR_DIVISOR)),
      bossHpLeftPct: result.hpRemaining[1] / boss.maxHp,
      rounds: result.rounds.length,
    };
  }

  return {
    dungeonId,
    floor,
    result,
    boss,
    heroCombatant: hero,
    won,
    gold,
    gems,
    xp,
    drop,
    setDrop,
    autoSoldGold,
    dungeonCleared: clearedWing,
    wallHint,
  };
}
