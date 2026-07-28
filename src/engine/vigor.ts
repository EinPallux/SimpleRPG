/** Vigor economy: Second Wind & Golden Ale (GAME_DESIGN.md §4). Mutates save drafts. */
import { ALE_COST_GEMS, ALE_MAX_PER_DAY, ALE_VIGOR, REFILL_SECOND_WIND } from './constants';
import type { GameSave } from './types';

export function canClaimSecondWind(save: GameSave): boolean {
  return !save.daily.secondWindUsed;
}

export function claimSecondWind(save: GameSave): void {
  if (!canClaimSecondWind(save)) throw new Error('Second Wind already claimed today');
  save.daily.secondWindUsed = true;
  save.daily.vigor += REFILL_SECOND_WIND;
}

export function canBuyAle(save: GameSave): boolean {
  return save.daily.aleUsed < ALE_MAX_PER_DAY && save.hero.gems >= ALE_COST_GEMS;
}

export function buyAle(save: GameSave): void {
  if (!canBuyAle(save)) throw new Error('Golden Ale unavailable (daily cap or gems)');
  save.hero.gems -= ALE_COST_GEMS;
  save.daily.aleUsed += 1;
  save.daily.vigor += ALE_VIGOR;
}
