import { describe, expect, it } from 'vitest';
import { CLASSES } from '@/content/classes';
import { parseGameSave } from '@/persist/schema';
import { HONOR_START, VIGOR_DAILY_BASE } from './constants';
import { createNewSave, deriveEmblem } from './newSave';

const NOW = new Date(2026, 6, 28, 14, 30).getTime(); // local 2026-07-28
const input = {
  name: 'Grimble',
  classId: 'warrior' as const,
  emblem: deriveEmblem('Grimble', 'warrior'),
  worldSeed: 'a'.repeat(32),
};

describe('createNewSave', () => {
  it('produces a schema-valid v1 save', () => {
    const save = createNewSave(input, NOW);
    expect(() => parseGameSave(save)).not.toThrow();
  });

  it('applies class starting attributes and day-1 economy', () => {
    for (const cls of CLASSES) {
      const save = createNewSave({ ...input, classId: cls.id, name: 'Testy' }, NOW);
      expect(save.hero.attrsBought).toEqual({ str: 0, dex: 0, int: 0, con: 0, lck: 0 });
      expect(save.hero.level).toBe(1);
      expect(save.hero.honor).toBe(HONOR_START);
      expect(save.daily.vigor).toBe(VIGOR_DAILY_BASE);
      expect(save.daily.dayKey).toBe('2026-07-28');
      expect(save.weekly.weekKey).toBe('2026-W31');
      expect(save.monthly.monthKey).toBe('2026-07');
    }
  });

  it('derives a stable emblem from name + class', () => {
    const a = deriveEmblem('Grimble', 'warrior');
    const b = deriveEmblem('Grimble', 'warrior');
    const c = deriveEmblem('Grimble', 'mage');
    expect(a).toEqual(b);
    expect([a.icon, a.palette]).not.toEqual([c.icon, c.palette]);
  });
});
