/**
 * The auto-battler (GAME_DESIGN.md §7, formulas BALANCING.md §3).
 * `simulateCombat` is pure: (combatants, seed) → full log, replayable forever.
 * The UI plays logs back (M2+); arena/dungeons/expeditions all run through here.
 */
import {
  CRIT_PER_LUCK,
  DR_CAP,
  DR_DIVISOR,
  EFF_MAIN_FLOOR,
  RAGE_PER_ROUND,
  ROUND_CAP,
} from './constants';
import { Rng, type RngState } from './rng';
import type { AttributeId } from './types';

export interface Combatant {
  id: string;
  name: string;
  level: number;
  mainAttr: AttributeId;
  attrs: Record<AttributeId, number>;
  maxHp: number;
  armor: number;
  /** primary weapon damage roll */
  weapon: { min: number; max: number };
  /** offhand roll for the second strike (assassin-style fighters) */
  offhandWeapon?: { min: number; max: number };
  /** class/archetype signature flags */
  blockChance: number;
  evadeChance: number;
  /** attacks ignore block/evade (Mage rule, Caster archetype) */
  unblockable: boolean;
  strikes: number; // 1, or 2 with strikeMult
  strikeMult: number; // damage factor per strike when strikes > 1
  dmgMult: number; // Mage 1.9
  critCap: number;
  critMult: number;
  /** Brute archetype: every 3rd round ×1.5 */
  brute?: boolean;
  /** Elite archetype: +5 pp crit */
  critBonus?: number;
}

export type StrikeOutcome = 'hit' | 'crit' | 'blocked' | 'evaded';

export interface StrikeEvent {
  attacker: 0 | 1;
  outcome: StrikeOutcome;
  damage: number;
  targetHpAfter: number;
}

export interface CombatRound {
  round: number;
  events: StrikeEvent[];
}

export interface CombatResult {
  /** 0 = first combatant (the attacker/initiator), 1 = second */
  winner: 0 | 1;
  /** attacker loses ties at the round cap (BALANCING §3.2) */
  tieBreak: boolean;
  rounds: CombatRound[];
  firstStriker: 0 | 1;
  hpRemaining: [number, number];
  seed: RngState;
}

function effMain(attacker: Combatant, defender: Combatant): number {
  const main = attacker.attrs[attacker.mainAttr];
  const counter = defender.attrs[attacker.mainAttr] / 2;
  return Math.max(main * EFF_MAIN_FLOOR, main - counter);
}

function damageReduction(defender: Combatant, attackerLevel: number): number {
  return Math.min(DR_CAP, defender.armor / (attackerLevel * DR_DIVISOR));
}

function critChance(attacker: Combatant, defender: Combatant): number {
  const pct =
    (attacker.attrs.lck * CRIT_PER_LUCK) / defender.level / 100 + (attacker.critBonus ?? 0);
  return Math.min(attacker.critCap, pct);
}

export function simulateCombat(a: Combatant, b: Combatant, seed: RngState): CombatResult {
  const rng = new Rng([...seed] as RngState); // never mutate the caller's copy
  const fighters: [Combatant, Combatant] = [a, b];
  const hp: [number, number] = [a.maxHp, b.maxHp];
  const rounds: CombatRound[] = [];
  const firstStriker: 0 | 1 = rng.chance(0.5) ? 0 : 1;

  for (let round = 1; round <= ROUND_CAP; round++) {
    const events: StrikeEvent[] = [];
    const order: (0 | 1)[] = firstStriker === 0 ? [0, 1] : [1, 0];

    for (const idx of order) {
      if (hp[0] <= 0 || hp[1] <= 0) break;
      const attacker = fighters[idx]!;
      const defIdx = (1 - idx) as 0 | 1;
      const defender = fighters[defIdx]!;

      for (let s = 0; s < attacker.strikes; s++) {
        if (hp[defIdx] <= 0) break;

        if (!attacker.unblockable) {
          if (defender.evadeChance > 0 && rng.chance(defender.evadeChance)) {
            events.push({ attacker: idx, outcome: 'evaded', damage: 0, targetHpAfter: hp[defIdx] });
            continue;
          }
          if (defender.blockChance > 0 && rng.chance(defender.blockChance)) {
            events.push({
              attacker: idx,
              outcome: 'blocked',
              damage: 0,
              targetHpAfter: hp[defIdx],
            });
            continue;
          }
        }

        const weapon = s > 0 && attacker.offhandWeapon ? attacker.offhandWeapon : attacker.weapon;
        const roll = rng.int(weapon.min, weapon.max);
        const rage = 1 + RAGE_PER_ROUND * (round - 1);
        const strikeMult = attacker.strikes > 1 ? attacker.strikeMult : 1;
        const bruteMult = attacker.brute && round % 3 === 0 ? 1.5 : 1;
        let damage =
          roll *
          (1 + effMain(attacker, defender) / 10) *
          rage *
          strikeMult *
          bruteMult *
          attacker.dmgMult *
          (1 - damageReduction(defender, attacker.level));

        const isCrit = rng.chance(critChance(attacker, defender));
        if (isCrit) damage *= attacker.critMult;
        const dealt = Math.max(1, Math.round(damage));

        hp[defIdx] = Math.max(0, hp[defIdx] - dealt);
        events.push({
          attacker: idx,
          outcome: isCrit ? 'crit' : 'hit',
          damage: dealt,
          targetHpAfter: hp[defIdx],
        });
      }
    }

    rounds.push({ round, events });
    if (hp[0] <= 0 || hp[1] <= 0) {
      const winner: 0 | 1 = hp[0] <= 0 ? 1 : 0;
      return { winner, tieBreak: false, rounds, firstStriker, hpRemaining: hp, seed };
    }
  }

  // Round cap: the initiator loses the stand-off.
  return { winner: 1, tieBreak: true, rounds, firstStriker, hpRemaining: hp, seed };
}
