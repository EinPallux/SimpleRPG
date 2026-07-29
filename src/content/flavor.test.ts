/**
 * The §13 required volumes, asserted against the real catalog.
 *
 * This exists because the failure mode is silent: the Patrol screen cycled ten
 * lines for three milestones after its pool was written, and nothing broke —
 * players just never saw half the writing. A pool that claims a size and cannot
 * deliver it should fail CI, not quietly render fewer jokes.
 */
import { describe, expect, it } from 'vitest';
import { hasKey, t } from '@/i18n';
import { missionFlavor } from '@/ui/itemName';
import {
  ARENA_QUIP_POOL,
  arenaQuipKey,
  MISSION_GENERIC_POOL,
  MISSION_ZONE_POOL,
  PATROL_TICK_POOL,
  patrolTickKey,
  poolKeys,
  TIPS_POOL,
  tipKey,
} from './flavor';
import { ZONES } from './zones';

describe('flavor pools (CONTENT §13 required volumes)', () => {
  it('hits the §13 volumes exactly: 72 mission lines, 20 patrol, 15+15 arena, 25 tips', () => {
    expect(ZONES.length * MISSION_ZONE_POOL + MISSION_GENERIC_POOL).toBe(72);
    expect(PATROL_TICK_POOL).toBe(20);
    expect(ARENA_QUIP_POOL).toBe(15);
    expect(TIPS_POOL).toBe(25);
  });

  it('every key a pool claims actually exists and reads as prose', () => {
    for (const { pool, keys } of poolKeys()) {
      for (const key of keys) {
        expect(hasKey(key), `${pool}: missing ${key}`).toBe(true);
        const text = t(key as Parameters<typeof t>[0]);
        expect(text.length, `${pool}: ${key} is too short to be a line`).toBeGreaterThan(10);
        expect(text, `${pool}: ${key} rendered its own key`).not.toBe(key);
      }
    }
  });

  it('no two lines in a pool are the same joke', () => {
    for (const { pool, keys } of poolKeys()) {
      const texts = keys.map((k) => t(k as Parameters<typeof t>[0]));
      expect(new Set(texts).size, `${pool} has duplicates`).toBe(texts.length);
    }
  });

  it('index helpers stay inside their pool for any input, including negatives', () => {
    for (const n of [-97, -1, 0, 1, 14, 15, 19, 20, 24, 25, 1000]) {
      expect(hasKey(patrolTickKey(n))).toBe(true);
      expect(hasKey(arenaQuipKey(true, n))).toBe(true);
      expect(hasKey(arenaQuipKey(false, n))).toBe(true);
      expect(hasKey(tipKey(n))).toBe(true);
    }
  });

  it('every zone now has its own six lines — no zone falls back to generic', () => {
    // Zones 4–10 were generic-only until M9; the fallback still exists for
    // zones a later patch adds, but no shipped zone should be using it.
    for (const zone of ZONES) {
      for (let i = 0; i < MISSION_ZONE_POOL; i++) {
        expect(hasKey(`mission.z${zone.index}.${i}`), `zone ${zone.index} line ${i}`).toBe(true);
      }
    }
  });

  it('mission flavor always yields prose for every zone and flavor roll', () => {
    for (const zone of ZONES) {
      const seen = new Set<string>();
      for (let flavor = 0; flavor < 60; flavor++) {
        const text = missionFlavor(zone.index, flavor);
        expect(text).not.toContain('mission.');
        expect(text.length).toBeGreaterThan(10);
        seen.add(text);
      }
      // A zone draws from both its own pool and the generic one, so 60 rolls
      // should surface well more than six distinct lines.
      expect(seen.size, `zone ${zone.index} variety`).toBeGreaterThan(10);
    }
  });
});
