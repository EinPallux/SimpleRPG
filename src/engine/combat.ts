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

  // — Full-set behaviors (BALANCING §4.6 / CONTENT §6.1; engine/sets.ts) —
  /** own blocks heal this fraction of max HP */
  healOnBlockPct?: number;
  /** after own block, next outgoing strike ×mult */
  afterBlockNextHitMult?: number;
  /** own blocks reflect this fraction of the would-be damage */
  reflectOnBlockPct?: number;
  /** after own evade, next outgoing strike is a guaranteed crit */
  afterEvadeCrit?: boolean;
  /** always takes the first turn (both sides having it → coin flip) */
  firstStrikeOverride?: boolean;
  /** this fighter's very first strike ×(1 + bonus) */
  firstStrikeDmgMult?: number;
  /** every nth outgoing strike ×mult */
  everyNthStrike?: { n: number; mult: number };
  /** the DEFENDER's damage reduction is capped at this vs this attacker */
  enemyDrCap?: number;
  /** own crits poison: pct of the crit per round, for `rounds` rounds */
  poisonOnCrit?: { pct: number; rounds: number };
  /** when both strikes of one turn crit, the second strike ×mult */
  doubleCritBonusMult?: number;
}

export type StrikeOutcome = 'hit' | 'crit' | 'blocked' | 'evaded';

export interface StrikeEvent {
  attacker: 0 | 1;
  outcome: StrikeOutcome;
  damage: number;
  targetHpAfter: number;
  /** poison tick (rendered as damage over time, not a swing) */
  dot?: true;
  /** damage bounced back onto the attacker by a blocking defender */
  reflect?: number;
  /** HP the defender healed by blocking (set fighters) */
  heal?: number;
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

function damageReduction(defender: Combatant, attacker: Combatant): number {
  const cap = Math.min(DR_CAP, attacker.enemyDrCap ?? DR_CAP);
  return Math.min(cap, defender.armor / (attacker.level * DR_DIVISOR));
}

function critChance(attacker: Combatant, defender: Combatant): number {
  const pct =
    (attacker.attrs.lck * CRIT_PER_LUCK) / defender.level / 100 + (attacker.critBonus ?? 0);
  return Math.min(attacker.critCap, pct);
}

/**
 * The full multiplier chain minus the roll — used for real strikes and for the
 * deterministic "would-be" damage a reflecting blocker throws back (thorns use
 * the average roll and skip crits so the base path's rng order never changes).
 */
function strikeChain(attacker: Combatant, defender: Combatant, round: number): number {
  const rage = 1 + RAGE_PER_ROUND * (round - 1);
  const strikeMult = attacker.strikes > 1 ? attacker.strikeMult : 1;
  const bruteMult = attacker.brute && round % 3 === 0 ? 1.5 : 1;
  return (
    (1 + effMain(attacker, defender) / 10) *
    rage *
    strikeMult *
    bruteMult *
    attacker.dmgMult *
    (1 - damageReduction(defender, attacker))
  );
}

interface SideState {
  /** ×mult armed by an own block (Ironroot Sentinel) */
  pendingHitMult: number;
  /** guaranteed crit armed by an own evade (Galewind Pathfinder) */
  pendingCrit: boolean;
  /** outgoing strikes that landed (Tidebound every-nth counter) */
  landed: number;
  /** true until this fighter's first landed strike resolves (Eyes of the Silent Wood) */
  firstStrikePending: boolean;
  /** active poison stacks on THIS side */
  dots: { perRound: number; roundsLeft: number }[];
}

export function simulateCombat(a: Combatant, b: Combatant, seed: RngState): CombatResult {
  const rng = new Rng([...seed] as RngState); // never mutate the caller's copy
  const fighters: [Combatant, Combatant] = [a, b];
  const hp: [number, number] = [a.maxHp, b.maxHp];
  const rounds: CombatRound[] = [];
  const state: [SideState, SideState] = [
    { pendingHitMult: 1, pendingCrit: false, landed: 0, firstStrikePending: true, dots: [] },
    { pendingHitMult: 1, pendingCrit: false, landed: 0, firstStrikePending: true, dots: [] },
  ];

  // First strike: an override side always opens; otherwise the classic coin
  // flip (its rng draw is skipped only when an override exists — no-set fights
  // consume the stream exactly as they always did).
  const aFirst = a.firstStrikeOverride === true;
  const bFirst = b.firstStrikeOverride === true;
  const firstStriker: 0 | 1 = aFirst !== bFirst ? (aFirst ? 0 : 1) : rng.chance(0.5) ? 0 : 1;

  for (let round = 1; round <= ROUND_CAP; round++) {
    const events: StrikeEvent[] = [];
    const order: (0 | 1)[] = firstStriker === 0 ? [0, 1] : [1, 0];

    for (const idx of order) {
      if (hp[0] <= 0 || hp[1] <= 0) break;
      const attacker = fighters[idx]!;
      const defIdx = (1 - idx) as 0 | 1;
      const defender = fighters[defIdx]!;
      const atkState = state[idx]!;
      const defState = state[defIdx]!;
      let critsThisTurn = 0;

      for (let s = 0; s < attacker.strikes; s++) {
        if (hp[defIdx] <= 0 || hp[idx] <= 0) break;

        if (!attacker.unblockable) {
          if (defender.evadeChance > 0 && rng.chance(defender.evadeChance)) {
            if (defender.afterEvadeCrit) defState.pendingCrit = true;
            events.push({ attacker: idx, outcome: 'evaded', damage: 0, targetHpAfter: hp[defIdx] });
            continue;
          }
          if (defender.blockChance > 0 && rng.chance(defender.blockChance)) {
            const event: StrikeEvent = {
              attacker: idx,
              outcome: 'blocked',
              damage: 0,
              targetHpAfter: hp[defIdx],
            };
            if (defender.healOnBlockPct) {
              const heal = Math.round(defender.maxHp * defender.healOnBlockPct);
              hp[defIdx] = Math.min(defender.maxHp, hp[defIdx] + heal);
              event.heal = heal;
              event.targetHpAfter = hp[defIdx];
            }
            if (defender.afterBlockNextHitMult) {
              defState.pendingHitMult = defender.afterBlockNextHitMult;
            }
            if (defender.reflectOnBlockPct) {
              // Thorns: pct of the average would-be hit, no extra rng draws.
              const weapon =
                s > 0 && attacker.offhandWeapon ? attacker.offhandWeapon : attacker.weapon;
              const avgRoll = (weapon.min + weapon.max) / 2;
              const wouldBe = avgRoll * strikeChain(attacker, defender, round);
              const reflect = Math.max(1, Math.round(wouldBe * defender.reflectOnBlockPct));
              hp[idx] = Math.max(0, hp[idx] - reflect);
              event.reflect = reflect;
            }
            events.push(event);
            continue;
          }
        }

        const weapon = s > 0 && attacker.offhandWeapon ? attacker.offhandWeapon : attacker.weapon;
        const roll = rng.int(weapon.min, weapon.max);
        let damage = roll * strikeChain(attacker, defender, round);

        atkState.landed += 1;
        if (atkState.firstStrikePending) {
          atkState.firstStrikePending = false;
          if (attacker.firstStrikeDmgMult) damage *= 1 + attacker.firstStrikeDmgMult;
        }
        if (atkState.pendingHitMult !== 1) {
          damage *= atkState.pendingHitMult;
          atkState.pendingHitMult = 1;
        }
        if (
          attacker.everyNthStrike &&
          atkState.landed % attacker.everyNthStrike.n === 0
        ) {
          damage *= attacker.everyNthStrike.mult;
        }

        let isCrit: boolean;
        if (atkState.pendingCrit) {
          atkState.pendingCrit = false;
          isCrit = true; // guaranteed — no roll consumed (set-only path)
        } else {
          isCrit = rng.chance(critChance(attacker, defender));
        }
        if (isCrit) {
          damage *= attacker.critMult;
          critsThisTurn += 1;
          // Masque of the Pale King: a critting pair lands the second twice as hard.
          if (attacker.doubleCritBonusMult && s > 0 && critsThisTurn >= 2) {
            damage *= attacker.doubleCritBonusMult;
          }
        }
        const dealt = Math.max(1, Math.round(damage));

        hp[defIdx] = Math.max(0, hp[defIdx] - dealt);
        events.push({
          attacker: idx,
          outcome: isCrit ? 'crit' : 'hit',
          damage: dealt,
          targetHpAfter: hp[defIdx],
        });

        if (isCrit && attacker.poisonOnCrit && hp[defIdx] > 0) {
          state[defIdx]!.dots.push({
            perRound: Math.max(1, Math.round(dealt * attacker.poisonOnCrit.pct)),
            roundsLeft: attacker.poisonOnCrit.rounds,
          });
        }
      }
    }

    // Poison ticks at round end — emitted as dot events so playback HP stays true.
    for (const idx of [0, 1] as const) {
      const sideState = state[idx]!;
      if (sideState.dots.length === 0 || hp[idx] <= 0 || hp[(1 - idx) as 0 | 1] <= 0) continue;
      let tick = 0;
      for (const dot of sideState.dots) {
        tick += dot.perRound;
        dot.roundsLeft -= 1;
      }
      sideState.dots = sideState.dots.filter((dot) => dot.roundsLeft > 0);
      if (tick > 0) {
        hp[idx] = Math.max(0, hp[idx] - tick);
        events.push({
          attacker: (1 - idx) as 0 | 1,
          outcome: 'hit',
          damage: tick,
          targetHpAfter: hp[idx],
          dot: true,
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
