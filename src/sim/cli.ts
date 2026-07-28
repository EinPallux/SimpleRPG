/**
 * Balance simulator CLI (BALANCING.md §9).
 *
 *   pnpm sim -- --profile optimal --days 30 [--seed my-seed] [--csv out.csv] [--par]
 */
import { writeFileSync } from 'node:fs';
import { parMainAttr } from '@/engine/par';
import { simulateDays, type Profile } from './run';

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const profile = (arg('profile', 'optimal') as Profile) ?? 'optimal';
const days = Number(arg('days', '30'));
const seed = arg('seed', 'sim-seed')!;
const csv = arg('csv');
const wantPar = process.argv.includes('--par');

if (!['optimal', 'casual', 'idle-only'].includes(profile) || !Number.isInteger(days) || days < 1) {
  console.error(
    'usage: pnpm sim -- --profile optimal|casual|idle-only --days N [--seed S] [--csv F] [--par]',
  );
  process.exit(1);
}

const started = performance.now();
const result = simulateDays(profile, days, seed);
const ms = (performance.now() - started).toFixed(0);

console.log(`\nSimpleRPG balance sim — profile=${profile} days=${days} seed=${seed} (${ms} ms)\n`);
console.log('day | level |   gold accum |  attrs | missions | patrol ticks');
console.log('----+-------+--------------+--------+----------+-------------');
const show = new Set([1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 150, 180, days]);
for (const r of result.records) {
  if (!show.has(r.day)) continue;
  console.log(
    `${String(r.day).padStart(3)} | ${String(r.level).padStart(5)} | ${String(Math.round(r.gold)).padStart(12)} | ${String(r.attrsTotal).padStart(6)} | ${String(r.missions).padStart(8)} | ${String(r.patrolTicks).padStart(12)}`,
  );
}
console.log(
  `\nFinal: level ${result.finalLevel}, gold ${Math.round(result.finalGold)}, attrs ${JSON.stringify(result.finalAttrs)}`,
);
const earned = result.goldFrom.missions + result.goldFrom.patrol + result.goldFrom.selling;
console.log(
  `Faucets: missions ${Math.round(result.goldFrom.missions)} (${Math.round((result.goldFrom.missions / earned) * 100)}%) · ` +
    `patrol ${Math.round(result.goldFrom.patrol)} (${Math.round((result.goldFrom.patrol / earned) * 100)}%) · ` +
    `selling ${Math.round(result.goldFrom.selling)} (${Math.round((result.goldFrom.selling / earned) * 100)}%)`,
);
console.log(
  `Attribute sink: ${Math.round(result.goldSpentOnAttrs)} gold (${Math.round((result.goldSpentOnAttrs / earned) * 100)}% of earnings) · equipped pieces: ${result.equippedCount}`,
);

if (wantPar) {
  console.log('\nPar check (measured evenly-spread attr vs analytic parMainAttr):');
  console.log('level | measured/attr | analytic par');
  const seen = new Set<number>();
  for (const r of result.records) {
    if (seen.has(r.level)) continue;
    seen.add(r.level);
    if (r.level % 5 !== 0) continue;
    console.log(
      `${String(r.level).padStart(5)} | ${String(Math.round(r.attrsTotal / 5)).padStart(13)} | ${String(parMainAttr(r.level)).padStart(12)}`,
    );
  }
  console.log('(M9 tuning regenerates the engine par tables from this data — BALANCING §2.4)');
}

if (csv) {
  const lines = ['day,level,gold,attrsTotal,missions,patrolTicks'];
  for (const r of result.records) {
    lines.push(
      `${r.day},${r.level},${Math.round(r.gold)},${r.attrsTotal},${r.missions},${r.patrolTicks}`,
    );
  }
  writeFileSync(csv, lines.join('\n') + '\n');
  console.log(`\nCSV written to ${csv}`);
}

// Contract quick-look (informational here; enforced in scenarios.test.ts)
const bounds: [number, number][] = [
  [1, 13],
  [7, 27],
  [30, 55],
  [90, 90],
  [180, 118],
];
for (const [d, cap] of bounds) {
  const rec = result.records[d - 1];
  if (rec) {
    const ok = rec.level <= cap ? 'OK' : 'OVER!';
    console.log(`contract day ${d}: level ${rec.level} ≤ ${cap} … ${ok}`);
  }
}
