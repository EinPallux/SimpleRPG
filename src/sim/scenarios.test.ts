/**
 * THE ANTI-RUSH CONTRACT (BALANCING.md §8.2) — release-blocking product
 * requirements, not test details (CLAUDE.md invariant 6). Bounds are ceilings
 * with deliberate headroom: quest/gem income (M6) still lands inside them.
 * Long-horizon scenarios share one cached 270-day run to keep CI fast.
 */
import { describe, expect, it } from 'vitest';
import { simulateDays, type SimResult } from './run';

let cached270: SimResult | null = null;
function opt270(): SimResult {
  cached270 ??= simulateDays('optimal', 270);
  return cached270;
}

function clearDay(r: SimResult, dungeonId: string, floor: number): number {
  return r.floorClears.find((c) => c.dungeonId === dungeonId && c.floor === floor)?.day ?? Infinity;
}

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

  it('optimal-90d/180d: the long horizon holds (≤ 90 / ≤ 118)', () => {
    const r = opt270();
    expect(r.records[89]!.level).toBeLessThanOrEqual(90);
    expect(r.records[89]!.level).toBeGreaterThanOrEqual(60);
    expect(r.records[179]!.level).toBeLessThanOrEqual(118);
    expect(r.records[179]!.level).toBeGreaterThanOrEqual(85);
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

  it('gold-faucet audit: sources and the attribute sink match BALANCING §6 intent', () => {
    const r = opt270();
    const f = r.goldFrom;
    const earned =
      f.missions + f.patrol + f.selling + f.arena + f.expeditions + f.dungeons + f.wheel;
    // Attributes must absorb the majority of lifetime gold (the infinite sink).
    expect(r.goldSpentOnAttrs / earned).toBeGreaterThan(0.6);
    // Missions remain the single largest faucet even with expeditions online.
    expect(f.missions / earned).toBeGreaterThan(0.4);
    for (const other of [f.patrol, f.selling, f.arena, f.expeditions, f.dungeons, f.wheel]) {
      expect(f.missions).toBeGreaterThan(other);
    }
    // Expeditions: the active premium — real, but not the backbone (§2.3: 1.125×).
    expect(f.expeditions / f.missions).toBeGreaterThan(0.25);
    expect(f.expeditions / f.missions).toBeLessThan(0.65);
    expect(f.arena / f.missions).toBeGreaterThan(0.1);
    expect(f.arena / f.missions).toBeLessThan(0.8);
    expect(f.patrol / f.missions).toBeGreaterThan(0.08);
    expect(f.patrol / f.missions).toBeLessThan(0.35);
    // The wheel is a gold sink that pays in items/gems/treats (§6).
    expect(r.goldSpentOnWheel).toBeGreaterThan(f.wheel);
    // Vendoring generic drops is deliberately pocket change (§6, §10 2026-07-28).
    expect(f.selling).toBeGreaterThan(0);
    expect(f.selling / f.missions).toBeLessThan(0.05);
    // The equip heuristic dressed the hero (item lifecycle works end to end).
    expect(r.equippedCount).toBeGreaterThanOrEqual(5);
  });

  it('ladder-alive-30d (M4 done-when): the world moves and the player climbs through it', () => {
    const r = simulateDays('optimal', 30);
    const d1 = r.records[0]!;
    const d30 = r.records[29]!;
    expect(d1.rank).toBeGreaterThan(500); // fresh heroes start deep in the pack
    // A month climbs >100 ranks. The leap cap (§4.5) deliberately slow-walks the
    // early pack; the ladder-rank1 scenario asserts the acceleration after it.
    expect(d30.rank).toBeLessThan(d1.rank - 100);
    expect(d30.honor).toBeGreaterThan(d1.honor);
    // Rank must move most days — a frozen ladder would be the illusion breaking.
    let moved = 0;
    for (let i = 1; i < 30; i++) {
      if (r.records[i]!.rank !== r.records[i - 1]!.rank) moved++;
    }
    expect(moved).toBeGreaterThan(20);
  });

  it('ladder-rank1 (§8.2): top-100 ≈ days 80–115, rank 1 within days 150–250 of optimal play', () => {
    const r = opt270();
    const top100Day = r.records.find((rec) => rec.rank <= 100)?.day ?? Infinity;
    const top10Day = r.records.find((rec) => rec.rank <= 10)?.day ?? Infinity;
    const rank1Day = r.records.find((rec) => rec.rank === 1)?.day ?? Infinity;
    expect(top100Day).toBeGreaterThanOrEqual(80);
    expect(top100Day).toBeLessThanOrEqual(115);
    expect(top10Day).toBeGreaterThan(top100Day + 15); // the top is its own journey
    expect(rank1Day).toBeGreaterThanOrEqual(150);
    expect(rank1Day).toBeLessThanOrEqual(250);
    // The summit is walls, not arithmetic: reaching rank 1 from top-10 takes real time.
    expect(rank1Day - top10Day).toBeGreaterThanOrEqual(20);
  });

  it('dungeon-walls (M5 done-when): the walls bounce you, growth breaks them', () => {
    const r = opt270();
    // Every wing opens in order and the first two clear while they matter.
    expect(clearDay(r, 'rat-cellars', 10)).toBeLessThanOrEqual(21);
    expect(clearDay(r, 'sunken-crypt', 10)).toBeLessThanOrEqual(45);
    expect(clearDay(r, 'ironroot-hollows', 10)).toBeLessThanOrEqual(90);
    // Mid-game wings are real walls: floors 5→10 take sustained growth.
    expect(clearDay(r, 'ironroot-hollows', 10) - clearDay(r, 'ironroot-hollows', 1)).toBeGreaterThanOrEqual(10);
    expect(clearDay(r, 'obsidian-spire', 10) - clearDay(r, 'obsidian-spire', 1)).toBeGreaterThanOrEqual(14);
    // Bounces happened: 3 daily attempts × days elapsed far exceeds 50 clears.
    const d4Span = clearDay(r, 'obsidian-spire', 10) - clearDay(r, 'rat-cellars', 1);
    expect(d4Span).toBeGreaterThanOrEqual(100); // four wings ≈ four months of heartbeat
  });

  it('dungeon-final (§8.2): the Pale King does not fall before day 140', () => {
    const r = opt270();
    expect(clearDay(r, 'pale-court', 10)).toBeGreaterThanOrEqual(140);
    // The court opens late but it does open — floor 5 within the run's horizon.
    expect(clearDay(r, 'pale-court', 5)).toBeLessThanOrEqual(260);
    // And D4 finishing well before 140 proves the gate is pacing, not a wall of nothing.
    expect(clearDay(r, 'obsidian-spire', 10)).toBeLessThanOrEqual(140);
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
  it.todo('casual-30d band [35,48] — needs quest XP (M6) in the casual policy');
  it.todo(
    'gem-strategies: ale-max vs gacha-max vs drake-first within 12% at day 120 — needs M5–M7',
  );
  it.todo(
    'zone-frontier: each zone reached within ±20% of its intended day — needs full XP sources',
  );
});
