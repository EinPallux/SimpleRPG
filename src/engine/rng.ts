/**
 * Seeded, streamed, serializable randomness (TECHNICAL_ARCHITECTURE.md §5).
 * Invariant 3: game logic never touches Math.random — every roll comes from a
 * named stream whose state lives in the save, so reload/export tricks replay
 * identically and systems can't starve each other's sequences.
 *
 * Generator: xoshiro128** (32-bit ops only), seeded per-stream via splitmix32
 * over fnv1a(worldSeed | streamName).
 */
import { fnv1a } from './hash';

export type StreamName =
  'combat' | 'loot' | 'missions' | 'gacha' | 'wheel' | 'botworld' | 'cosmetic';

export const STREAM_NAMES: readonly StreamName[] = [
  'combat',
  'loot',
  'missions',
  'gacha',
  'wheel',
  'botworld',
  'cosmetic',
];

/** Serialized generator state — four 32-bit words, stored in the save. */
export type RngState = [number, number, number, number];

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
}

export function seedState(worldSeed: string, stream: string): RngState {
  const mix = splitmix32(fnv1a(`${worldSeed}|${stream}`));
  const state: RngState = [mix(), mix(), mix(), mix()];
  // xoshiro must never be all-zero (fnv+splitmix make this astronomically
  // unlikely, but a save is forever).
  if (state.every((w) => w === 0)) state[0] = 0x1badb002;
  return state;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * A mutable generator view over an RngState. `state` is mutated in place so
 * callers holding the save see the advanced state (persisted with the save).
 */
export class Rng {
  constructor(private readonly state: RngState) {}

  /** Raw next uint32 (xoshiro128**). */
  nextUint32(): number {
    const s = this.state;
    const result = (Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] = (s[2] ^ s[0]) >>> 0;
    s[3] = (s[3] ^ s[1]) >>> 0;
    s[1] = (s[1] ^ s[2]) >>> 0;
    s[0] = (s[0] ^ s[3]) >>> 0;
    s[2] = (s[2] ^ t) >>> 0;
    s[3] = rotl(s[3], 11);
    return result;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`rng.int: max < min (${min}..${max})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick a uniform random element. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('rng.pick: empty array');
    return items[this.int(0, items.length - 1)]!;
  }

  /** Weighted pick: entries of [item, weight>0]. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) throw new Error('rng.weighted: no positive weights');
    let roll = this.next() * total;
    for (const [item, w] of entries) {
      roll -= w;
      if (roll < 0) return item;
    }
    return entries[entries.length - 1]![0];
  }

  /** Derive an independent one-shot seed (e.g. a combat seed stored in a log). */
  deriveSeed(): RngState {
    return [this.nextUint32(), this.nextUint32(), this.nextUint32(), this.nextUint32()];
  }
}

/** All stream states for a fresh save. */
export function initialRngState(worldSeed: string): Record<StreamName, RngState> {
  return Object.fromEntries(
    STREAM_NAMES.map((name) => [name, seedState(worldSeed, name)]),
  ) as Record<StreamName, RngState>;
}

/**
 * Stream accessor over a save's rngState bag. Lazily initializes missing
 * streams from the world seed (covers saves created before a stream existed).
 */
export function getStream(
  bag: Partial<Record<StreamName, RngState>>,
  worldSeed: string,
  name: StreamName,
): Rng {
  let state = bag[name];
  if (!state) {
    state = seedState(worldSeed, name);
    bag[name] = state;
  }
  return new Rng(state);
}
