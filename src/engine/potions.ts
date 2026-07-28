/**
 * Elixirs (GAME_DESIGN.md §9.5): +% to one attribute for 24h, three sockets,
 * one potion per attribute (buying the same attribute replaces it).
 */
import { getElixir } from '@/content/elixirs';
import { ELIXIR_DURATION_H, ELIXIR_PCT, ELIXIR_PRICE_MULT, POTION_SLOTS } from './constants';
import { missionGold } from './economy';
import type { ActivePotion, AttributeId, GameSave } from './types';

/** Price scales with the buyer's level — a standing gold sink (BALANCING §5.4). */
export function elixirPrice(save: GameSave, elixirId: string): number {
  const def = getElixir(elixirId);
  return Math.ceil(missionGold(save.hero.level, 10) * ELIXIR_PRICE_MULT[def.tier - 1]!);
}

export function elixirPercent(elixirId: string): number {
  return ELIXIR_PCT[getElixir(elixirId).tier - 1]!;
}

export function canBuyElixir(save: GameSave, elixirId: string): { ok: boolean; reason?: string } {
  const def = getElixir(elixirId);
  if (save.hero.gold < elixirPrice(save, elixirId)) return { ok: false, reason: 'gold' };
  const replacesSameAttr = save.hero.potions.some((p) => p.attribute === def.attribute);
  if (!replacesSameAttr && save.hero.potions.length >= POTION_SLOTS) {
    return { ok: false, reason: 'slots' };
  }
  return { ok: true };
}

export function buyElixir(save: GameSave, elixirId: string, nowMs: number): ActivePotion {
  const check = canBuyElixir(save, elixirId);
  if (!check.ok) throw new Error(`Cannot buy elixir: ${check.reason}`);
  const def = getElixir(elixirId);
  save.hero.gold -= elixirPrice(save, elixirId);
  const potion: ActivePotion = {
    elixirId,
    attribute: def.attribute,
    expiresAt: new Date(nowMs + ELIXIR_DURATION_H * 3_600_000).toISOString(),
  };
  save.hero.potions = [...save.hero.potions.filter((p) => p.attribute !== def.attribute), potion];
  save.stats.elixirsDrunk = (save.stats.elixirsDrunk ?? 0) + 1;
  return potion;
}

/** Drop expired potions. Called from catch-up and before stat-sensitive actions. */
export function prunePotions(save: GameSave, nowMs: number): void {
  if (save.hero.potions.length === 0) return;
  const alive = save.hero.potions.filter((p) => Date.parse(p.expiresAt) > nowMs);
  if (alive.length !== save.hero.potions.length) save.hero.potions = alive;
}

/** Active % bonus for one attribute (0 when no potion). */
export function potionPercent(save: GameSave, attr: AttributeId): number {
  const potion = save.hero.potions.find((p) => p.attribute === attr);
  return potion ? elixirPercent(potion.elixirId) : 0;
}
