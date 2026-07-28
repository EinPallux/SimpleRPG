/**
 * One granter for every `MetaReward` in the game (quests, story steps, calendar
 * slots, achievement tiers). Keeping payouts in one place means a reward table
 * is pure data — content never has to know how gold, gems, drops, titles or
 * frames actually land.
 *
 * `gold`/`xp` are multipliers of a 10-vigor frontier mission (BALANCING §2.3),
 * so a table written once stays correct at every level.
 */
import type { MetaReward } from '@/content/meta';
import { ELIXIR_DURATION_H, ELIXIR_PCT } from './constants';
import { ELIXIRS } from '@/content/elixirs';
import { SETS } from '@/content/sets';
import { missionGold, missionXp } from './economy';
import { rollDrop, sellPrice } from './items';
import { recordDrop } from './ledger';
import { getStream } from './rng';
import { rollSetPiece } from './sets';
import type { ActivePotion, GameSave, ItemInstance } from './types';
import { applyXp, type XpResult } from './xpGain';

export interface GrantedReward {
  gold: number;
  xp: XpResult | null;
  gems: number;
  scraps: number;
  dust: number;
  treats: number;
  items: ItemInstance[];
  potion: ActivePotion | null;
  titleId: string | null;
  frameId: string | null;
  /** paid instead of an item when the backpack was full */
  autoSoldGold: number;
}

/** Unlock a title if it is new. Returns true when it was actually new. */
export function grantTitle(save: GameSave, titleId: string): boolean {
  if (save.progress.titles.includes(titleId)) return false;
  save.progress.titles.push(titleId);
  return true;
}

export function grantFrame(save: GameSave, frameId: string): boolean {
  if (save.progress.frames.includes(frameId)) return false;
  save.progress.frames.push(frameId);
  return true;
}

/** Sets whose pieces this hero can meaningfully receive (own class or any). */
function eligibleSetIds(save: GameSave): string[] {
  const ids = SETS.filter(
    (s) => (s.classId === null || s.classId === save.hero.classId) && s.level <= save.hero.level + 5,
  ).map((s) => s.id);
  return ids.length > 0 ? ids : ['innkeepers-regalia'];
}

/** A gifted elixir: the best tier the hero has grown into, on a free socket. */
function grantElixir(save: GameSave, nowMs: number): ActivePotion | null {
  const tier = save.hero.level >= 40 ? 3 : save.hero.level >= 20 ? 2 : 1;
  const taken = new Set(save.hero.potions.map((p) => p.attribute));
  const candidates = ELIXIRS.filter((e) => e.tier === tier);
  const fresh = candidates.filter((e) => !taken.has(e.attribute));
  // Prefer an empty socket; otherwise refresh one the hero already runs.
  const def = fresh[0] ?? candidates[0];
  if (!def) return null;
  const potion: ActivePotion = {
    elixirId: def.id,
    attribute: def.attribute,
    expiresAt: new Date(nowMs + ELIXIR_DURATION_H * 3_600_000).toISOString(),
  };
  save.hero.potions = [...save.hero.potions.filter((p) => p.attribute !== def.attribute), potion];
  save.stats.elixirsDrunk = (save.stats.elixirsDrunk ?? 0) + 1;
  void ELIXIR_PCT;
  return potion;
}

/**
 * `nowMs` is required, not defaulted: engine code never reads the wall clock
 * (CLAUDE.md invariant 4). Only elixir rewards actually use it, but threading
 * it keeps every payout replayable from a save + a timestamp.
 */
export function grantReward(save: GameSave, reward: MetaReward, nowMs: number): GrantedReward {
  const m10 = missionGold(save.hero.level, 10);
  const granted: GrantedReward = {
    gold: 0,
    xp: null,
    gems: 0,
    scraps: 0,
    dust: 0,
    treats: 0,
    items: [],
    potion: null,
    titleId: null,
    frameId: null,
    autoSoldGold: 0,
  };

  if (reward.gold) {
    granted.gold = Math.round(m10 * reward.gold);
    save.hero.gold += granted.gold;
    save.stats.goldEarned = (save.stats.goldEarned ?? 0) + granted.gold;
  }
  if (reward.gems) {
    granted.gems = reward.gems;
    save.hero.gems += reward.gems;
  }
  if (reward.scraps) {
    granted.scraps = reward.scraps;
    save.hero.scraps += reward.scraps;
  }
  if (reward.dust) {
    granted.dust = reward.dust;
    save.hero.dust += reward.dust;
  }
  if (reward.treats) {
    granted.treats = reward.treats;
    save.hero.treats += reward.treats;
  }

  if (reward.item || reward.setPiece) {
    const loot = getStream(save.rngState, save.worldSeed, 'loot');
    const item = reward.setPiece
      ? rollSetPiece(save, loot.pick(eligibleSetIds(save)), loot)
      : rollDrop('chest', save.hero.level, save.hero.classId, loot);
    recordDrop(save, item);
    granted.items.push(item);
    if (save.inventory.backpack.length < save.inventory.capacity) {
      save.inventory.backpack.push(item);
    } else {
      granted.autoSoldGold = sellPrice(item);
      save.hero.gold += granted.autoSoldGold;
      save.stats.goldEarned = (save.stats.goldEarned ?? 0) + granted.autoSoldGold;
    }
  }

  if (reward.elixir) granted.potion = grantElixir(save, nowMs);
  if (reward.titleId && grantTitle(save, reward.titleId)) granted.titleId = reward.titleId;
  if (reward.frameId && grantFrame(save, reward.frameId)) granted.frameId = reward.frameId;

  // XP last: a level-up mid-grant would otherwise change the payouts above.
  if (reward.xp) {
    granted.xp = applyXp(save, Math.round(missionXp(save.hero.level, 10) * reward.xp));
  }
  return granted;
}
