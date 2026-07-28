/**
 * THE ANTI-RUSH CONTRACT (BALANCING.md §8.2) — release-blocking product
 * requirements, not test details (CLAUDE.md invariant 6). Bounds are ceilings
 * with deliberate headroom: arena (M4), dungeons/expeditions (M5) and quest/gem
 * income (M6) will add XP inside these same limits as their policies land.
 */
import { describe, expect, it } from 'vitest';
import { simulateDays } from './run';

describe('anti-rush contract (optimal play ceilings)', () => {
  it('optimal-24h: a fresh save cannot exceed level 13 on day one', () => {
    const r = simulateDays('optimal', 1);
    expect(r.finalLevel).toBeLessThanOrEqual(13);
    expect(r.finalLevel).toBeGreaterThanOrEqual(6); // fun floor: day one must still feel S&F-fast
  });

  it('optimal-7d: level ≤ 27', () => {
    const r = simulateDays('optimal', 7);
    expect(r.finalLevel).toBeLessThanOrEqual(27);
    expect(r.finalLevel).toBeGreaterThanOrEqual(17);
  });

  it('optimal-30d: level ≤ 55', () => {
    const r = simulateDays('optimal', 30);
    expect(r.finalLevel).toBeLessThanOrEqual(55);
    expect(r.finalLevel).toBeGreaterThanOrEqual(35);
  });

  it('the gold economy keeps absorbing: attribute totals keep growing week over week', () => {
    const r = simulateDays('optimal', 21);
    const week = (n: number) => r.records[n * 7 - 1]!.attrsTotal;
    expect(week(1)).toBeGreaterThan(30);
    expect(week(2)).toBeGreaterThan(week(1) * 1.4);
    expect(week(3)).toBeGreaterThan(week(2) * 1.2);
  });

  it('casual play trails optimal meaningfully but is not buried', () => {
    const optimal = simulateDays('optimal', 14);
    const casual = simulateDays('casual', 14);
    expect(casual.finalLevel).toBeLessThan(optimal.finalLevel);
    expect(casual.finalLevel).toBeGreaterThan(optimal.finalLevel * 0.5);
  });

  it('gold-faucet audit (M3 done-when): sources and the attribute sink match BALANCING §6 intent', () => {
    const r = simulateDays('optimal', 21);
    const earned = r.goldFrom.missions + r.goldFrom.patrol + r.goldFrom.selling;
    // Attributes must absorb the majority of lifetime gold (the infinite sink).
    expect(r.goldSpentOnAttrs / earned).toBeGreaterThan(0.6);
    // Missions are the backbone; patrol and selling are meaningful side streams.
    expect(r.goldFrom.missions / earned).toBeGreaterThan(0.6);
    expect(r.goldFrom.patrol / r.goldFrom.missions).toBeGreaterThan(0.08);
    expect(r.goldFrom.patrol / r.goldFrom.missions).toBeLessThan(0.35);
    // Vendoring generic drops is deliberately pocket change (§6, §10 2026-07-28):
    // loot's value is equipping and scraps. Present, but bounded.
    expect(r.goldFrom.selling).toBeGreaterThan(0);
    expect(r.goldFrom.selling / r.goldFrom.missions).toBeLessThan(0.05);
    // The equip heuristic dressed the hero (item lifecycle works end to end).
    expect(r.equippedCount).toBeGreaterThanOrEqual(5);
  });

  it('simulation is fully deterministic per seed', () => {
    const a = simulateDays('optimal', 5, 'seed-a');
    const b = simulateDays('optimal', 5, 'seed-a');
    const c = simulateDays('optimal', 5, 'seed-c');
    expect(a).toEqual(b);
    expect(a.records).not.toEqual(c.records); // different world, different rolls
  });

  // Contract rows that need systems from later milestones — wired up when the
  // corresponding policy support lands (kept visible here on purpose):
  it.todo('casual-30d band [35,48] — needs arena (M4) + quest XP (M6) in the casual policy');
  it.todo('dungeon-final: Pale King floor 10 not clearable before day 140 — needs dungeons (M5)');
  it.todo('ladder-rank1: rank 1 in days 170–270, top-100 ≈ day 75 ±15 — needs bot ladder (M4)');
  it.todo(
    'gem-strategies: ale-max vs gacha-max vs drake-first within 12% at day 120 — needs M5–M7',
  );
  it.todo(
    'zone-frontier: each zone reached within ±20% of its intended day — needs full XP sources',
  );
});
