import { describe, expect, it } from 'vitest';
import { getSet } from '@/content/sets';
import { attemptFloor, bossCombatant, canAttemptFloor, dungeonStatus } from './dungeons';
import { generateSetPiece } from './items';
import { createNewSave, deriveEmblem } from './newSave';
import { Rng, seedState } from './rng';
import type { GameSave } from './types';

const T0 = new Date(2026, 6, 28, 9, 0).getTime();
const MIN = 60_000;

function fresh(level = 13, mighty = true): GameSave {
  const save = createNewSave(
    {
      name: 'Delver',
      classId: 'warrior',
      emblem: deriveEmblem('Delver', 'warrior'),
      worldSeed: 'ef'.repeat(16),
    },
    T0,
  );
  save.hero.level = level;
  save.hero.attrsBought = mighty
    ? { str: 500, dex: 200, int: 50, con: 400, lck: 200 }
    : { str: 10, dex: 5, int: 1, con: 8, lck: 5 };
  return save;
}

describe('dungeons', () => {
  it('status: gates by level, walks floors, reports the next boss', () => {
    const save = fresh(13);
    const rats = dungeonStatus(save, 'rat-cellars', T0);
    expect(rats.unlocked).toBe(true);
    expect(rats.nextFloor).toBe(1);
    expect(rats.nextBoss?.slug).toBe('squeaker');
    expect(rats.nextBossLevel).toBeGreaterThanOrEqual(13);
    expect(dungeonStatus(save, 'sunken-crypt', T0).unlocked).toBe(false);
    expect(canAttemptFloor(save, 'obsidian-spire', T0)).toEqual({ ok: false, reason: 'locked' });
  });

  it('bosses are §4 stat walls: fatter and meaner than par, traits attached', () => {
    const floor1 = bossCombatant('rat-cellars', 1);
    const floor10 = bossCombatant('rat-cellars', 10);
    expect(floor10.maxHp).toBeGreaterThan(floor1.maxHp * 2);
    expect(floor10.level).toBeGreaterThan(floor1.level);
    expect(bossCombatant('rat-cellars', 7).unblockable).toBe(true); // Mold King Sporus, caster
    expect(bossCombatant('rat-cellars', 4).brute).toBe(true); // Gnawbone
    expect(bossCombatant('rat-cellars', 2).evadeChance).toBeCloseTo(0.1); // Twitchwhisker
  });

  it('a win advances the floor, pays gems/gold/xp, drops Rare+ and starts the hourglass', () => {
    const save = fresh(13);
    const outcome = attemptFloor(save, 'rat-cellars', T0);
    expect(outcome.won).toBe(true); // 500 str at L13 flattens a L14 rat
    expect(save.progress.dungeonFloors['rat-cellars']).toBe(1);
    expect(outcome.gems).toBe(1);
    expect(save.hero.gems).toBe(1);
    expect(outcome.gold).toBeGreaterThan(0);
    expect(outcome.xp?.gained).toBeGreaterThan(0);
    expect(['rare', 'epic', 'legendary']).toContain(outcome.drop?.rarity);
    expect(canAttemptFloor(save, 'rat-cellars', T0)).toEqual({ ok: false, reason: 'cooldown' });
    expect(() => attemptFloor(save, 'rat-cellars', T0 + MIN)).toThrow(/cooldown/);
    expect(canAttemptFloor(save, 'rat-cellars', T0 + 61 * MIN).ok).toBe(true);
  });

  it('floor 5 pays the class set piece with the bigger gem purse', () => {
    const save = fresh(20);
    save.progress.dungeonFloors['rat-cellars'] = 4;
    const outcome = attemptFloor(save, 'rat-cellars', T0);
    expect(outcome.won).toBe(true);
    expect(outcome.setDrop).toBe(true);
    expect(outcome.drop?.rarity).toBe('set');
    expect(outcome.drop?.setId).toBe('bulwark-boar'); // warrior's L20 set
    expect(outcome.gems).toBe(3);
  });

  it('fixed-pool wings pity into the class set once their set is complete', () => {
    const save = fresh(40);
    save.progress.dungeonFloors['sunken-crypt'] = 4;
    const rig = new Rng(seedState('rig', 'innkeeper'));
    for (const slot of getSet('innkeepers-regalia').slots) {
      save.inventory.backpack.push(generateSetPiece('innkeepers-regalia', slot, rig));
    }
    const outcome = attemptFloor(save, 'sunken-crypt', T0);
    expect(outcome.won).toBe(true);
    expect(outcome.drop?.setId).toBe('bulwark-boar'); // L20 warrior pity
  });

  it('a bounce reports the wall honestly and still turns the hourglass', () => {
    const save = fresh(13, false); // a wet noodle vs floor 1
    const outcome = attemptFloor(save, 'rat-cellars', T0);
    expect(outcome.won).toBe(false);
    expect(save.progress.dungeonFloors['rat-cellars'] ?? 0).toBe(0);
    expect(outcome.wallHint).not.toBeNull();
    expect(outcome.wallHint!.bossHpLeftPct).toBeGreaterThan(0);
    expect(outcome.wallHint!.rounds).toBeGreaterThan(0);
    expect(canAttemptFloor(save, 'rat-cellars', T0)).toEqual({ ok: false, reason: 'cooldown' });
    expect(save.hero.gems).toBe(0);
  });

  it('a finished wing refuses further attempts', () => {
    const save = fresh(30);
    save.progress.dungeonFloors['rat-cellars'] = 10;
    expect(dungeonStatus(save, 'rat-cellars', T0).nextFloor).toBeNull();
    expect(canAttemptFloor(save, 'rat-cellars', T0)).toEqual({ ok: false, reason: 'cleared' });
  });

  it('the wing-clearing floor pays the completion bonus', () => {
    const save = fresh(28);
    save.progress.dungeonFloors['rat-cellars'] = 9;
    const outcome = attemptFloor(save, 'rat-cellars', T0);
    expect(outcome.won).toBe(true);
    expect(outcome.dungeonCleared).toBe(true);
    expect(outcome.gems).toBe(8); // 3 set-floor + 5 completion
    expect(outcome.drop?.setId).toBe('bulwark-boar');
  });
});
