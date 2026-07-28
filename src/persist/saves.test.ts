import { beforeEach, describe, expect, it } from 'vitest';
import { createNewSave, deriveEmblem } from '@/engine/newSave';
import { db } from './db';
import {
  deleteSlot,
  getActiveSlot,
  listSlotSummaries,
  loadSlot,
  persistSlot,
  randomWorldSeed,
  setActiveSlot,
} from './saves';

const NOW = new Date(2026, 6, 28).getTime();

function makeSave(name: string) {
  return createNewSave(
    { name, classId: 'scout', emblem: deriveEmblem(name, 'scout'), worldSeed: randomWorldSeed() },
    NOW,
  );
}

beforeEach(async () => {
  await db.saves.clear();
  await db.backups.clear();
  await db.meta.clear();
});

describe('slot persistence (the M0 "save roundtrip" gate)', () => {
  it('persists and loads a save losslessly', async () => {
    const save = makeSave('Grimble');
    await persistSlot(1, save);
    const loaded = await loadSlot(1);
    expect(loaded).toEqual(save);
  });

  it('keeps the three slots isolated and summarized', async () => {
    await persistSlot(1, makeSave('Alpha'));
    await persistSlot(3, makeSave('Gamma'));
    const summaries = await listSlotSummaries();
    expect(summaries).toHaveLength(3);
    expect(summaries[0]?.name).toBe('Alpha');
    expect(summaries[1]).toBeNull();
    expect(summaries[2]?.name).toBe('Gamma');
  });

  it('rejects out-of-range slots', async () => {
    await expect(persistSlot(4, makeSave('Nope'))).rejects.toThrow();
    await expect(loadSlot(0)).rejects.toThrow();
  });

  it('creates a backup on first persist but not on rapid re-persists', async () => {
    const save = makeSave('Backup');
    await persistSlot(2, save);
    await persistSlot(2, save);
    await persistSlot(2, save);
    expect(await db.backups.where('slot').equals(2).count()).toBe(1);
  });

  it('prunes backups beyond the rotation window', async () => {
    for (let i = 0; i < 8; i++) {
      await db.backups.add({
        slot: 1,
        at: new Date(NOW - (10 - i) * 60 * 60_000).toISOString(),
        save: makeSave(`Old${i}`),
      });
    }
    await persistSlot(1, makeSave('Fresh'));
    expect(await db.backups.where('slot').equals(1).count()).toBeLessThanOrEqual(5);
  });

  it('delete clears save, backups and active marker', async () => {
    await persistSlot(1, makeSave('Doomed'));
    await setActiveSlot(1);
    await deleteSlot(1);
    expect(await loadSlot(1)).toBeNull();
    expect(await db.backups.where('slot').equals(1).count()).toBe(0);
    expect(await getActiveSlot()).toBeNull();
  });

  it('world seeds are unique and well-formed', () => {
    const a = randomWorldSeed();
    const b = randomWorldSeed();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
