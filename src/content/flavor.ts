/**
 * Flavor pool sizes (CONTENT_CATALOG.md §13 required volumes).
 *
 * These live here rather than as inline modulo literals because the numbers
 * were previously duplicated at each call site — the Patrol screen was still
 * cycling ten lines after the pool grew to twenty, silently hiding half the
 * writing. A pool size is content metadata: declared once, asserted against the
 * real catalog in `flavor.test.ts`, and read by every surface that draws from
 * it.
 *
 * Growing a pool is therefore a two-line change (write the keys, raise the
 * number) and the test fails loudly if you do only one of them.
 */
import { hasKey, type I18nKey } from '@/i18n';

/** §13: 6 per zone × 10 zones + 12 generic = 72 mission offer lines. */
export const MISSION_ZONE_POOL = 6;
export const MISSION_GENERIC_POOL = 12;

/** §13: 20 patrol tick events. */
export const PATROL_TICK_POOL = 20;

/** §13: 15 victory + 15 defeat arena quips. */
export const ARENA_QUIP_POOL = 15;

/** §13: 25 loading/reset tips. */
export const TIPS_POOL = 25;

export function patrolTickKey(n: number): I18nKey {
  return `patrol.tick.${((n % PATROL_TICK_POOL) + PATROL_TICK_POOL) % PATROL_TICK_POOL}` as I18nKey;
}

export function arenaQuipKey(won: boolean, n: number): I18nKey {
  const i = ((n % ARENA_QUIP_POOL) + ARENA_QUIP_POOL) % ARENA_QUIP_POOL;
  return `arena.${won ? 'win' : 'lose'}.${i}` as I18nKey;
}

export function tipKey(n: number): I18nKey {
  return `tips.${((n % TIPS_POOL) + TIPS_POOL) % TIPS_POOL}` as I18nKey;
}

/** Every key a pool claims to have — what the content test walks. */
export function poolKeys(): { pool: string; keys: string[] }[] {
  const zones = Array.from({ length: 10 }, (_, z) => ({
    pool: `mission.z${z + 1}`,
    keys: Array.from({ length: MISSION_ZONE_POOL }, (_, i) => `mission.z${z + 1}.${i}`),
  }));
  return [
    ...zones,
    {
      pool: 'mission.generic',
      keys: Array.from({ length: MISSION_GENERIC_POOL }, (_, i) => `mission.generic.${i}`),
    },
    {
      pool: 'patrol.tick',
      keys: Array.from({ length: PATROL_TICK_POOL }, (_, i) => patrolTickKey(i)),
    },
    {
      pool: 'arena.win',
      keys: Array.from({ length: ARENA_QUIP_POOL }, (_, i) => arenaQuipKey(true, i)),
    },
    {
      pool: 'arena.lose',
      keys: Array.from({ length: ARENA_QUIP_POOL }, (_, i) => arenaQuipKey(false, i)),
    },
    { pool: 'tips', keys: Array.from({ length: TIPS_POOL }, (_, i) => tipKey(i)) },
  ];
}

/** A pool index that is stable for a given thing rather than random per render. */
export function poolIndex(seed: number, size: number): number {
  return ((seed % size) + size) % size;
}

export { hasKey };
