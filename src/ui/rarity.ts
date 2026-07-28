import type { ItemInstance } from '@/engine/types';

/** Rarity → text color utility (UI_DESIGN.md §2 rarity palette). */
export const RARITY_TEXT: Record<ItemInstance['rarity'], string> = {
  common: 'text-[#9aa3ad]',
  uncommon: 'text-[#57b65f]',
  rare: 'text-[#4c8be0]',
  epic: 'text-[#a64ce0]',
  set: 'text-[#35c99a]',
  legendary: 'text-[#e08a2e]',
};
