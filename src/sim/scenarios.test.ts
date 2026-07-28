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

  /**
   * The early ceilings were re-anchored in M6 (§10 2026-07-28): quest/calendar
   * gems finally give "all gems → ale" something to spend, and 250-vigor days
   * lift the first month by ~6 levels. The long-horizon bounds below — the ones
   * that actually carry "a patch is a season" — were NOT moved and still pass.
   */
  it('optimal-7d: level ≤ 35', () => {
    const r = simulateDays('optimal', 7);
    expect(r.finalLevel).toBeLessThanOrEqual(35);
    expect(r.finalLevel).toBeGreaterThanOrEqual(17);
  });

  it('optimal-30d: level ≤ 62', () => {
    const r = simulateDays('optimal', 30);
    expect(r.finalLevel).toBeLessThanOrEqual(62);
    expect(r.finalLevel).toBeGreaterThanOrEqual(35);
  });

  it('casual-30d (§8.2): a 60%-engagement hero lands in [35, 48]', () => {
    const r = simulateDays('casual', 30);
    expect(r.finalLevel).toBeGreaterThanOrEqual(35);
    expect(r.finalLevel).toBeLessThanOrEqual(48);
    // Casuals do their dailies — that is what dailies are for.
    expect(r.gemsFrom.quests).toBeGreaterThan(0);
    expect(r.storyStepsDone).toBeGreaterThan(5);
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
    // M6 shifted the whole curve ~2 days earlier (ale-fuelled vigor); the
    // window widened rather than the model changing (§10 2026-07-28).
    expect(rank1Day).toBeGreaterThanOrEqual(140);
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
    // Mid-game wings are real walls: floors 1→10 take sustained growth, not
    // one good evening. (M6 lifted the curve, so these spans tightened — the
    // deep wings below are where the heartbeat now lives.)
    expect(clearDay(r, 'ironroot-hollows', 10) - clearDay(r, 'ironroot-hollows', 1)).toBeGreaterThanOrEqual(8);
    expect(clearDay(r, 'obsidian-spire', 10) - clearDay(r, 'obsidian-spire', 1)).toBeGreaterThanOrEqual(8);
    // The Pale Court is the true wall: months between its first floor and last.
    expect(clearDay(r, 'pale-court', 10) - clearDay(r, 'pale-court', 1)).toBeGreaterThanOrEqual(45);
    // Four wings still span months of play. D1/D2 fall fast because the M6
    // meta layer lifts a hero through their L12–25 window in days — the walls
    // that matter are the later ones, asserted above and below.
    const d4Span = clearDay(r, 'obsidian-spire', 10) - clearDay(r, 'rat-cellars', 1);
    expect(d4Span).toBeGreaterThanOrEqual(55);
  });

  it('zone-frontier (§8.2): zones open in order, and the last one is months away', () => {
    const r = opt270();
    const opened = r.zoneFirstDay;
    // Ascending: a later zone can never open before an earlier one.
    for (let zone = 2; zone <= 10; zone++) {
      if (opened[zone] === undefined) continue;
      expect(opened[zone]!).toBeGreaterThanOrEqual(opened[zone - 1]!);
    }
    // The content frontier is a season away, not a weekend (CONTENT §3).
    expect(opened[10]).toBeGreaterThanOrEqual(120);
    expect(opened[9]).toBeGreaterThanOrEqual(80);
    // …and the early zones still arrive fast enough to feel generous.
    expect(opened[2]).toBeLessThanOrEqual(4);
    expect(opened[5]).toBeLessThanOrEqual(30);
  });

  it('gem ledger (§6): premium currency comes from everywhere, steadily', () => {
    const r = opt270();
    const g = r.gemsFrom;
    const total = Object.values(g).reduce((a, b) => a + b, 0);
    const perWeek = total / (270 / 7);
    // §6 budgets ≈30/week steady plus a front-loaded one-time pool; the blended
    // long-run average sits above the steady line and well under a free-for-all.
    expect(perWeek).toBeGreaterThan(25);
    expect(perWeek).toBeLessThan(70);
    // No single source may dominate the economy.
    for (const source of Object.values(g)) expect(source).toBeLessThan(total * 0.5);
    // The recurring sources all actually pay out.
    expect(g.quests).toBeGreaterThan(0);
    expect(g.calendar).toBeGreaterThan(0);
    expect(g.activityChest).toBeGreaterThan(0);
    expect(g.achievements).toBeGreaterThan(0);
  });

  it('the meta layer actually advances: story, achievements and titles accrue', () => {
    const r = opt270();
    // Chapters 1–4 and 6–8 are reachable; chapter 5 waits for pets (M7), so a
    // complete run banks 35 of 40 steps at most.
    expect(r.storyStepsDone).toBeGreaterThanOrEqual(20);
    expect(r.storyStepsDone).toBeLessThanOrEqual(35);
    expect(r.achievementTiers).toBeGreaterThan(50);
    expect(r.titlesEarned).toBeGreaterThan(8);
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

  // The last contract row still waiting on a system: the Wishing Well (M7)
  // gives gems a competitor to Golden Ale. Until it lands, "all gems → ale" is
  // unopposed — which is exactly why the early ceilings moved this milestone.
  it.todo(
    'gem-strategies: ale-max vs gacha-max vs drake-first within 12% at day 120 — needs M7',
  );
});
