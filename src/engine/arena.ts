/**
 * The Arena (GAME_DESIGN.md §8.1): 10 rewarded bouts a day against bots that
 * look exactly like players, honor as a capped place-swap ladder currency,
 * unlimited sparring afterwards. Offers derive from (worldSeed, dayKey,
 * fightsToday) — fixed until you fight, so there is nothing to fish.
 */
import {
  ARENA_CHEST_CHANCE,
  ARENA_COOLDOWN_MIN,
  ARENA_COOLDOWN_SKIP_GEMS,
  ARENA_FIGHTS_PER_DAY,
  ARENA_LOSS_GOLD_MULT,
  ARENA_MILESTONES,
  ARENA_WIN_GOLD_MULT,
  ARENA_WIN_XP_MULT,
  HONOR_FLOOR,
  HONOR_LEAP_CAP_FLAT,
  HONOR_LEAP_CAP_PCT,
  HONOR_LEAPFROG_BONUS,
  HONOR_LOSS_BASE,
  HONOR_LOSS_FACTOR,
  HONOR_LOSS_MIN,
  HONOR_WIN_MIN,
} from './constants';
import { simulateCombat, type Combatant, type CombatResult } from './combat';
import { heroToCombatant } from './combatants';
import { missionGold, missionXp } from './economy';
import { fnv1a } from './hash';
import { rollDrop, sellPrice } from './items';
import { bump, lower, raise, recordCombat, recordDrop } from './ledger';
import {
  botCombatant,
  botLadder,
  playerRank,
  worldDayIndex,
  type BotSnapshot,
} from './botworld';
import { getStream, Rng, seedState } from './rng';
import type { GameSave, ItemInstance } from './types';
import { applyXp, type XpResult } from './xpGain';

export interface ArenaOffer {
  bot: BotSnapshot;
  rank: number;
  /** honor change preview on a win */
  honorOnWin: number;
  stance: 'safe' | 'even' | 'risky';
}

export function fightsLeft(save: GameSave): number {
  return Math.max(0, ARENA_FIGHTS_PER_DAY - save.activities.arena.fightsToday);
}

export function arenaCooldownRemaining(save: GameSave, nowMs: number): number {
  const until = save.activities.arena.cooldownUntil;
  if (!until) return 0;
  return Math.max(0, Date.parse(until) - nowMs);
}

/**
 * Capped place-swap: winning moves you toward (and past) the loser's honor,
 * but a single upset can only leap max(HONOR_LEAP_CAP_FLAT, HONOR_LEAP_CAP_PCT
 * of your honor) — passing a wall takes sustained wins, so ladder position
 * tracks real, repeatable power (BALANCING §4.5).
 */
export function honorOnWin(yourHonor: number, theirHonor: number): number {
  const leap = theirHonor + HONOR_LEAPFROG_BONUS - yourHonor;
  const cap = Math.max(HONOR_LEAP_CAP_FLAT, Math.round(yourHonor * HONOR_LEAP_CAP_PCT));
  return Math.max(HONOR_WIN_MIN, Math.min(cap, leap));
}

export function honorOnLoss(yourHonor: number, theirHonor: number): number {
  const gap = Math.max(0, yourHonor - theirHonor);
  return Math.max(HONOR_LOSS_MIN, Math.round(HONOR_LOSS_BASE + gap * HONOR_LOSS_FACTOR));
}

/**
 * Three opponents drawn near the player's rank: one clearly below, one at par,
 * one above (better honor). Deterministic for (save day, fights fought).
 * `stance` costs a few rehearsal bouts — the UI wants it, the sim doesn't.
 */
export function getArenaOffers(
  save: GameSave,
  nowMs: number,
  opts: { stance?: boolean } = {},
): ArenaOffer[] {
  const withStance = opts.stance ?? true;
  const dayIndex = worldDayIndex(save, nowMs);
  const ladder = botLadder(save.worldSeed, dayIndex);
  const rank = playerRank(save, nowMs);
  const rng = new Rng(
    seedState(save.worldSeed, `arena|${save.daily.dayKey}|${save.activities.arena.fightsToday}`),
  );

  // Offsets in ladder positions (positive = weaker/below, negative = stronger/above)
  const spread = Math.max(4, Math.round(ladder.length * 0.02));
  const picks = [
    rank - 1 + rng.int(2, spread), // below
    rank - 1 + rng.int(-1, 1), // par
    rank - 1 - rng.int(2, spread), // above
  ];

  const offers: ArenaOffer[] = [];
  const used = new Set<number>();
  for (const pick of picks) {
    // Wraparound probe: near the ladder's edges the clamped picks collide,
    // and a one-directional walk would deadlock at the boundary.
    let idx = Math.min(ladder.length - 1, Math.max(0, pick));
    while (used.has(idx)) idx = (idx + 1) % ladder.length;
    used.add(idx);
    const bot = ladder[idx]!;
    offers.push({
      bot,
      rank: idx + 1,
      honorOnWin: honorOnWin(save.hero.honor, bot.honor),
      stance: withStance ? quickStance(save, bot) : 'even',
    });
  }
  return offers;
}

/** Fast win-chance words via a few throwaway-seeded rehearsal bouts. */
function quickStance(save: GameSave, bot: BotSnapshot): 'safe' | 'even' | 'risky' {
  const hero = heroToCombatant(save);
  const rival = botCombatant(bot, save.worldSeed);
  let wins = 0;
  const trials = 5;
  for (let i = 0; i < trials; i++) {
    const seed = seedState(save.worldSeed, `stance|${save.daily.dayKey}|${bot.id}|${i}|${fnv1a(bot.name)}`);
    if (simulateCombat(hero, rival, seed).winner === 0) wins++;
  }
  if (wins >= 4) return 'safe';
  if (wins >= 2) return 'even';
  return 'risky';
}

export interface ArenaOutcome {
  result: CombatResult;
  opponent: BotSnapshot;
  opponentCombatant: Combatant;
  heroCombatant: Combatant;
  won: boolean;
  sparring: boolean;
  honorDelta: number;
  gold: number;
  xp: XpResult | null;
  chest: ItemInstance | null;
  /** chest flogged by the arena clerk because the backpack was full */
  chestAutoSoldGold: number;
  newRank: number;
  milestoneGems: number;
}

export function canFight(save: GameSave, nowMs: number): boolean {
  return arenaCooldownRemaining(save, nowMs) === 0;
}

export function skipCooldown(save: GameSave): void {
  if (save.hero.gems < ARENA_COOLDOWN_SKIP_GEMS) throw new Error('Not enough gems');
  if (!save.activities.arena.cooldownUntil) return;
  save.hero.gems -= ARENA_COOLDOWN_SKIP_GEMS;
  save.activities.arena.cooldownUntil = null;
}

/** Fight one of today's offers. After the 10 rewarded bouts it becomes sparring. */
export function fightArena(save: GameSave, offerIndex: number, nowMs: number): ArenaOutcome {
  if (!canFight(save, nowMs)) throw new Error('The arena master taps the hourglass (cooldown)');
  const offers = getArenaOffers(save, nowMs, { stance: false });
  const offer = offers[offerIndex];
  if (!offer) throw new Error(`No arena offer at index ${offerIndex}`);

  const sparring = fightsLeft(save) === 0;
  const hero = heroToCombatant(save);
  const rival = botCombatant(offer.bot, save.worldSeed);
  const combatStream = getStream(save.rngState, save.worldSeed, 'combat');
  const result = simulateCombat(hero, rival, combatStream.deriveSeed());
  const won = result.winner === 0;
  recordCombat(save, result);

  let honorDelta = 0;
  let gold = 0;
  let xp: XpResult | null = null;
  let chest: ItemInstance | null = null;
  let chestAutoSoldGold = 0;
  let milestoneGems = 0;

  if (!sparring) {
    save.activities.arena.fightsToday += 1;
    save.activities.arena.cooldownUntil = new Date(
      nowMs + ARENA_COOLDOWN_MIN * 60_000,
    ).toISOString();

    bump(save, 'arenaFights');
    if (won) {
      honorDelta = honorOnWin(save.hero.honor, offer.bot.honor);
      gold = Math.round(missionGold(save.hero.level, 10) * ARENA_WIN_GOLD_MULT);
      bump(save, 'arenaWins');
      bump(save, 'arenaWinStreak');
      raise(save, 'arenaBestStreak', save.stats.arenaWinStreak ?? 0);
      const loot = getStream(save.rngState, save.worldSeed, 'loot');
      if (loot.chance(ARENA_CHEST_CHANCE)) {
        chest = rollDrop('chest', save.hero.level, save.hero.classId, loot);
        recordDrop(save, chest);
        if (save.inventory.backpack.length < save.inventory.capacity) {
          save.inventory.backpack.push(chest);
        } else {
          // Full backpack: flogged on the spot, same as mission overflow.
          chestAutoSoldGold = sellPrice(chest);
        }
      }
    } else {
      honorDelta = -honorOnLoss(save.hero.honor, offer.bot.honor);
      gold = Math.round(missionGold(save.hero.level, 10) * ARENA_LOSS_GOLD_MULT);
      bump(save, 'arenaLosses');
      save.stats.arenaWinStreak = 0;
    }
    // Using every rewarded bout in a day is its own small feat (§10 mastery).
    if (save.activities.arena.fightsToday === ARENA_FIGHTS_PER_DAY) {
      bump(save, 'perfectArenaDays');
    }

    save.hero.honor = Math.max(HONOR_FLOOR, save.hero.honor + honorDelta);
    save.hero.gold += gold + chestAutoSoldGold;
    save.stats.goldEarned = (save.stats.goldEarned ?? 0) + gold + chestAutoSoldGold;
    if (won) {
      xp = applyXp(save, Math.round(missionXp(save.hero.level, 10) * ARENA_WIN_XP_MULT));
    }
  }

  const newRank = playerRank(save, nowMs);
  lower(save, 'arenaBestRank', newRank);
  for (const [threshold, gems] of ARENA_MILESTONES) {
    const key = `arena-rank-${threshold}`;
    if (newRank <= threshold && !save.progress.milestonesClaimed.includes(key)) {
      save.progress.milestonesClaimed.push(key);
      save.hero.gems += gems;
      milestoneGems += gems;
    }
  }

  return {
    result,
    opponent: offer.bot,
    opponentCombatant: rival,
    heroCombatant: hero,
    won,
    sparring,
    honorDelta,
    gold,
    xp,
    chest,
    chestAutoSoldGold,
    newRank,
    milestoneGems,
  };
}
