/**
 * The Codex (GAME_DESIGN.md §13, unlock L25): a collection log that pays.
 * Bestiary pages fill from where you actually go — expedition fights name real
 * zone monsters and every mission is a sighting (engine/ledger.ts) — and each
 * completed zone page grants a permanent +1% gold find. Armory completion pays
 * XP. All page bonuses share the global caps in BALANCING §6.
 */
import { MONSTERS, monstersOfZone } from '@/content/bestiary';
import { LORE_KILL_THRESHOLD } from '@/content/meta';
import { ZONES } from '@/content/zones';
import {
  CODEX_GOLD_PER_ZONE,
  CODEX_UNLOCK_LEVEL,
  CODEX_XP_PER_ARMORY_TIER,
} from './constants';
import type { GameSave } from './types';

export function codexUnlocked(save: GameSave): boolean {
  return save.hero.level >= CODEX_UNLOCK_LEVEL;
}

export interface MonsterEntry {
  id: string;
  zoneIndex: number;
  kills: number;
  discovered: boolean;
  /** lore is earned at 10 kills (§13) */
  loreUnlocked: boolean;
}

export function monsterEntry(save: GameSave, monsterId: string): MonsterEntry {
  const def = MONSTERS.find((m) => m.id === monsterId);
  if (!def) throw new Error(`Unknown monster: ${monsterId}`);
  const kills = save.progress.codex.monstersSeen[monsterId] ?? 0;
  return {
    id: monsterId,
    zoneIndex: def.zoneIndex,
    kills,
    discovered: kills > 0,
    loreUnlocked: kills >= LORE_KILL_THRESHOLD,
  };
}

/** Mark a lore entry as actually read (the Scholar's secret achievement). */
export function readLore(save: GameSave, monsterId: string): void {
  if (monsterEntry(save, monsterId).loreUnlocked) {
    save.progress.codex.loreSeen[monsterId] = true;
  }
}

export interface ZonePage {
  zoneIndex: number;
  discovered: number;
  total: number;
  complete: boolean;
}

export function zonePage(save: GameSave, zoneIndex: number): ZonePage {
  const monsters = monstersOfZone(zoneIndex);
  const discovered = monsters.filter(
    (m) => (save.progress.codex.monstersSeen[m.id] ?? 0) > 0,
  ).length;
  return {
    zoneIndex,
    discovered,
    total: monsters.length,
    complete: monsters.length > 0 && discovered === monsters.length,
  };
}

export function zonePages(save: GameSave): ZonePage[] {
  return ZONES.map((_, i) => zonePage(save, i + 1));
}

export function zonesCompleted(save: GameSave): number {
  return zonePages(save).filter((p) => p.complete).length;
}

/** Armory "tiers" are rarity bands; each fully-seen band pays XP. */
const ARMORY_TIERS = ['common', 'uncommon', 'rare', 'epic', 'set', 'legendary'] as const;

export function armorySeen(save: GameSave): number {
  return Object.keys(save.progress.codex.itemsSeen).length;
}

/**
 * Permanent codex bonuses. Fractions, pre-cap — `stats.gearPercents` folds
 * these in and applies the global ceilings (BALANCING §6).
 */
export function codexBonuses(save: GameSave): { goldFind: number; xp: number } {
  if (!codexUnlocked(save)) return { goldFind: 0, xp: 0 };
  const goldFind = zonesCompleted(save) * CODEX_GOLD_PER_ZONE;
  // One "tier" of the armory per ~1/6th of the designs seen.
  const armoryFraction = Math.min(1, armorySeen(save) / (ARMORY_TIERS.length * 10));
  const xp = Math.floor(armoryFraction * ARMORY_TIERS.length) * CODEX_XP_PER_ARMORY_TIER;
  return { goldFind, xp };
}

export const TOTAL_MONSTERS = MONSTERS.length;
