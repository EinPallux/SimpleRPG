/**
 * The audio map, wired to the game (UI_DESIGN.md §7). Mounted once by the Shell.
 *
 * Everything worth a noise in this game is a *result*, and every result lands
 * in the store as an outcome object that then sits there until the player
 * closes its modal. So the trigger has to be identity, not truthiness: each
 * channel remembers the exact object it last sounded for and fires only when a
 * genuinely new one arrives. Reacting to `outcome !== null` instead would
 * replay the cue on every unrelated store write — an autosave tick, a toast
 * expiring, a screen change — for as long as the reveal stayed open.
 *
 * It subscribes rather than selects because nothing here renders: a fanfare
 * should not cost the Shell a re-render.
 */
import { useEffect, useRef } from 'react';
import type { CombatResult } from '@/engine/combat';
import type { TossResult } from '@/engine/gacha';
import { useGame } from '@/state/store';
import { playSfx, type SfxCue } from '../audio';

type GameState = ReturnType<typeof useGame.getState>;

/** One store field that can land a result worth hearing. */
type Channel = 'reveal' | 'arena' | 'dungeon' | 'wheel' | 'toss' | 'meta';

const CHANNELS: readonly Channel[] = ['reveal', 'arena', 'dungeon', 'wheel', 'toss', 'meta'];

interface Landing {
  /** the outcome object — its reference *is* the identity of this result */
  token: object | null;
  cues: readonly SfxCue[];
}

const SILENT: Landing = { token: null, cues: [] };

/** Only resolve cues for a channel that actually landed something. */
function landing<T extends object>(
  token: T | null,
  cues: (outcome: T) => readonly SfxCue[],
): Landing {
  return token ? { token, cues: cues(token) } : SILENT;
}

/**
 * The stinger a batch of tosses earned — best prize wins, one stinger per batch.
 *
 * All THREE rarity cues are reachable, and each is named for what it actually
 * plays for (UI_DESIGN §7 lists "rarity stingers x3"). An earlier cut gated the
 * epic cue on set pieces alone, which left a genuine `kind: 'epic'` toss silent
 * and `rarity_rare` fired from nowhere in the entire game. A consumable still
 * gets the splash and nothing more: a fanfare that fires for everything stops
 * meaning anything.
 */
function tossStinger(results: readonly TossResult[]): readonly SfxCue[] {
  if (results.some((r) => r.kind === 'legendary' || r.item?.rarity === 'legendary')) {
    return ['rarity_legendary'];
  }
  // A set piece is the thing the pity meter counts toward, so it rides with epic.
  if (results.some((r) => r.kind === 'epic' || r.kind === 'setPiece' || r.setId !== null)) {
    return ['rarity_epic'];
  }
  if (results.some((r) => r.kind === 'rare')) return ['rarity_rare'];
  return [];
}

/**
 * Did the hero turn a blow aside? The combat log records every strike, so a
 * bout that contained a block earns the clang on top of its win/loss cue.
 *
 * The hero is always side 0 in a generated `CombatResult`, so a blocked strike
 * whose ATTACKER was side 1 is one the hero blocked. Without this the cue
 * existed in the dictionary and was played by nothing.
 */
function heroBlocked(result: CombatResult): boolean {
  return result.rounds.some((round) =>
    round.events.some((e) => e.outcome === 'blocked' && e.attacker === 1),
  );
}

/** UI_DESIGN §7 audio map, read off whatever the store is holding right now. */
function landings(s: GameState): Record<Channel, Landing> {
  return {
    // A mission pays in coins; one that also popped a chest gets the lid instead.
    reveal: landing(s.reveal, (r) => [r.chest ? 'chest_open' : 'coin_burst']),
    arena: landing(s.arenaOutcome, (o) => [
      o.won ? 'crit_hit' : 'ui_deny',
      ...(heroBlocked(o.result) ? (['block_clang'] as const) : []),
    ]),
    dungeon: landing(s.dungeonOutcome, (o) => [
      o.won ? 'crit_hit' : 'ui_deny',
      ...(heroBlocked(o.result) ? (['block_clang'] as const) : []),
    ]),
    wheel: landing(s.wheelOutcome, () => ['wheel_tick']),
    toss: landing(s.tossOutcome, (o) => ['well_splash', ...tossStinger(o.results)]),
    meta: landing(s.metaReward, () => ['levelup_fanfare']),
  };
}

export function useSfx(): void {
  // A ref, not state: this hook exists to make noise, never to cause a render.
  const played = useRef<Record<Channel, object | null>>({
    reveal: null,
    arena: null,
    dungeon: null,
    wheel: null,
    toss: null,
    meta: null,
  });

  useEffect(() => {
    const seen = played.current;
    const sync = (s: GameState, audible: boolean) => {
      const current = landings(s);
      for (const channel of CHANNELS) {
        const { token, cues } = current[channel];
        if (seen[channel] === token) continue;
        seen[channel] = token;
        if (audible && token) for (const cue of cues) playSfx(cue);
      }
    };
    // Whatever is already on screen when the Shell mounts has had its moment.
    sync(useGame.getState(), false);
    return useGame.subscribe((s) => sync(s, true));
  }, []);
}
