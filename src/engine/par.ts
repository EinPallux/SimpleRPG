/**
 * Attribute-par curves (BALANCING.md §2.4/§4): what the economy affords an
 * on-curve player at level L. Enemy templates scale off these. Currently the
 * analytic seed curves; `pnpm sim -- --par` prints measured values so M9's
 * tuning pass can regenerate them from real economy output.
 */
import { PAR_ARMOR_PER_LEVEL, PAR_CON_COEF, PAR_MAIN_COEF, PAR_MAIN_EXP } from './constants';

export function parMainAttr(level: number): number {
  return Math.round(PAR_MAIN_COEF * Math.pow(level, PAR_MAIN_EXP));
}

export function parCon(level: number): number {
  return Math.round(PAR_CON_COEF * Math.pow(level, PAR_MAIN_EXP));
}

/** Par HP uses the Scout/typical factor 4.0 as the neutral baseline. */
export function parHp(level: number): number {
  return Math.round(parCon(level) * 4.0 * (level + 1));
}

export function parArmor(level: number): number {
  return Math.round(PAR_ARMOR_PER_LEVEL * level);
}

/** Par secondary attribute (defense stat vs one attack school) ≈ 55% of main. */
export function parOffAttr(level: number): number {
  return Math.round(parMainAttr(level) * 0.55);
}
