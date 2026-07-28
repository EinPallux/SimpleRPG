/**
 * The single time authority (TECHNICAL_ARCHITECTURE.md §6). Engine logic never
 * reads wall-clock time directly — a Clock is injected, so tests and the
 * balance simulator can travel freely.
 */

export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  // The one sanctioned wall-clock read in the codebase (see eslint engine rules).
  // eslint-disable-next-line no-restricted-properties
  now: () => Date.now(),
};

/** A frozen clock for tests and fixtures. */
export function fixedClock(ms: number): Clock {
  return { now: () => ms };
}

/** A movable clock for simulations and time-travel tests. */
export function steppableClock(startMs: number): Clock & { advance(ms: number): void } {
  let t = startMs;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}
