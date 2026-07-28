import { describe, expect, it } from 'vitest';
import { BOT_COUNT, WORLD_AGE_DAYS } from './constants';
import {
  botCombatant,
  botDisplayGear,
  botLadder,
  botSnapshot,
  ladderWithPlayer,
  levelFromEquivalents,
  playerRank,
  worldDayIndex,
} from './botworld';
import { slotOf } from './items';
import { createNewSave, deriveEmblem } from './newSave';

const SEED = 'ladder-test-seed-0123456789abcdef';
const T0 = new Date(2026, 6, 28, 9, 0).getTime();

function fresh() {
  return createNewSave(
    { name: 'Rung', classId: 'mage', emblem: deriveEmblem('Rung', 'mage'), worldSeed: SEED },
    T0,
  );
}

describe('bot world', () => {
  it('derives the same 750 bots every time — nothing stored', () => {
    const a = botLadder(SEED, WORLD_AGE_DAYS);
    const b = botLadder(SEED, WORLD_AGE_DAYS);
    expect(a).toHaveLength(BOT_COUNT);
    expect(a).toEqual(b);
    expect(botLadder('other-seed-entirely-different!', WORLD_AGE_DAYS)).not.toEqual(a);
  });

  it('names look like a real server (three styles, fully unique after dedup)', () => {
    const ladder = botLadder(SEED, WORLD_AGE_DAYS);
    const names = new Set(ladder.map((b) => b.name));
    expect(names.size).toBe(BOT_COUNT); // ladder-level collision handling (§12)
    const gamerish = ladder.filter((b) => /\d|_|Xx|HD/.test(b.name)).length;
    expect(gamerish / BOT_COUNT).toBeGreaterThan(0.25); // gamer tags present in force
    expect(ladder.some((b) => / the /.test(b.name))).toBe(true); // roleplay handles too
  });

  it('day-0 world looks three weeks old with a sane level spread', () => {
    const ladder = botLadder(SEED, WORLD_AGE_DAYS);
    const top = ladder[0]!;
    const levels = ladder.map((b) => b.level);
    // Top no-lifers land in the high 40s — ahead of a 21-day optimal player,
    // still under the 30-day contract ceiling (§8.2: 55).
    expect(Math.max(...levels)).toBeLessThanOrEqual(50);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(25);
    expect(levels.filter((l) => l <= 10).length).toBeGreaterThan(70); // plenty of smallfolk
    expect(top.honor).toBeGreaterThan(1000);
  });

  it('bots progress over time, and the ladder shuffles as they do', () => {
    const d30 = botLadder(SEED, WORLD_AGE_DAYS + 30);
    const d0 = botLadder(SEED, WORLD_AGE_DAYS);
    const avg = (rows: typeof d0) => rows.reduce((s, b) => s + b.level, 0) / rows.length;
    expect(avg(d30)).toBeGreaterThan(avg(d0) + 3);
    const top10a = d0.slice(0, 10).map((b) => `${b.id}:${b.generation}`);
    const top10b = d30.slice(0, 10).map((b) => `${b.id}:${b.generation}`);
    expect(top10a).not.toEqual(top10b); // somebody always overtakes somebody
  });

  it('rage-quitters get replaced by fresh joiners over long spans', () => {
    let successors = 0;
    for (let slot = 0; slot < BOT_COUNT; slot++) {
      if (botSnapshot(SEED, slot, WORLD_AGE_DAYS + 365).generation > 0) successors++;
    }
    // ~2%/month over 12 months ≈ 20% of slots turned over at least once
    expect(successors).toBeGreaterThan(BOT_COUNT * 0.08);
    expect(successors).toBeLessThan(BOT_COUNT * 0.45);
  });

  it('level inversion helper matches the MPL curve shape', () => {
    expect(levelFromEquivalents(0)).toBe(1);
    expect(levelFromEquivalents(20)).toBeGreaterThanOrEqual(8);
    expect(levelFromEquivalents(20)).toBeLessThanOrEqual(12);
    expect(levelFromEquivalents(500)).toBeGreaterThan(levelFromEquivalents(100));
  });

  it('splices the player into the ladder by honor and ranks consistently', () => {
    const save = fresh();
    const rows = ladderWithPlayer(save, T0);
    expect(rows).toHaveLength(BOT_COUNT + 1);
    const playerRow = rows.find((r) => r.bot === null)!;
    expect(playerRow.rank).toBe(playerRank(save, T0));
    expect(playerRow.rank).toBeGreaterThan(BOT_COUNT * 0.7); // fresh heroes start low
    save.hero.honor = 10_000_000;
    expect(playerRank(save, T0)).toBe(1);
  });

  it('bot kits are stable within a level band and scale with level', () => {
    const day = WORLD_AGE_DAYS + 10;
    const bot = botLadder(SEED, day)[5]!;
    const kitA = botCombatant(bot, SEED);
    const kitB = botCombatant(bot, SEED);
    expect(kitA).toEqual(kitB);
    const low = botLadder(SEED, day)[700]!;
    expect(kitA.maxHp).toBeGreaterThan(botCombatant(low, SEED).maxHp);
  });

  it('profile gear snapshots are stable, slot-unique and scale with level', () => {
    const ladder = botLadder(SEED, WORLD_AGE_DAYS + 40);
    const top = ladder[0]!;
    const a = botDisplayGear(top, SEED);
    expect(a).toEqual(botDisplayGear(top, SEED)); // inspecting twice → same kit
    const slots = a.map((item) => slotOf(item));
    expect(new Set(slots).size).toBe(slots.length);
    expect(a.length).toBeGreaterThanOrEqual(4); // a seasoned bot looks dressed
    for (const item of a) expect(Math.abs(item.ilvl - top.level)).toBeLessThanOrEqual(3);
    const low = ladder[740]!;
    expect(botDisplayGear(low, SEED).length).toBeLessThanOrEqual(a.length);
  });

  it('worldDayIndex starts at the world age and advances daily', () => {
    const save = fresh();
    expect(worldDayIndex(save, T0)).toBe(WORLD_AGE_DAYS);
    expect(worldDayIndex(save, T0 + 5 * 86_400_000)).toBe(WORLD_AGE_DAYS + 5);
  });
});
