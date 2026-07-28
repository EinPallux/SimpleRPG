import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/persist/db';
import { loadSlot } from '@/persist/saves';
import { useGame } from './store';

beforeEach(async () => {
  await db.saves.clear();
  await db.backups.clear();
  await db.meta.clear();
  useGame.setState({
    phase: 'boot',
    slots: [],
    lastActiveSlot: null,
    activeSlot: null,
    save: null,
    screen: 'tavern',
    settingsOpen: false,
    toasts: [],
  });
});

describe('game store', () => {
  it('bootstraps to the title with empty slots', async () => {
    await useGame.getState().bootstrap();
    expect(useGame.getState().phase).toBe('title');
    expect(useGame.getState().slots).toEqual([null, null, null]);
  });

  it('createHero persists and enters the game', async () => {
    await useGame.getState().createHero(1, { name: 'Grimble', classId: 'warrior' });
    const s = useGame.getState();
    expect(s.phase).toBe('ingame');
    expect(s.activeSlot).toBe(1);
    expect(s.save?.hero.name).toBe('Grimble');
    const onDisk = await loadSlot(1);
    expect(onDisk?.hero.name).toBe('Grimble');
    expect(s.slots[0]?.name).toBe('Grimble');
  });

  it('export → import roundtrips into another slot', async () => {
    await useGame.getState().createHero(1, { name: 'Exporty', classId: 'mage' });
    const code = useGame.getState().exportActive();
    expect(code).toBeTruthy();
    const result = await useGame.getState().importCode(2, code!);
    expect(result.ok).toBe(true);
    const clone = await loadSlot(2);
    expect(clone?.hero.name).toBe('Exporty');
    expect(clone?.hero.classId).toBe('mage');
  });

  it('rejects a broken import with a readable message', async () => {
    const result = await useGame.getState().importCode(2, 'SRPG1.not-really');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(5);
  });

  it('exitToTitle flushes and returns; deleteSlot clears an active hero', async () => {
    await useGame.getState().createHero(2, { name: 'Leaver', classId: 'scout' });
    await useGame.getState().exitToTitle();
    expect(useGame.getState().phase).toBe('title');
    expect(useGame.getState().save).toBeNull();

    await useGame.getState().continueSlot(2);
    expect(useGame.getState().phase).toBe('ingame');
    await useGame.getState().deleteSlot(2);
    expect(useGame.getState().phase).toBe('title');
    expect(await loadSlot(2)).toBeNull();
  });

  it('caps visible toasts at three', () => {
    const { toast } = useGame.getState();
    toast('one');
    toast('two');
    toast('three');
    toast('four');
    expect(useGame.getState().toasts).toHaveLength(3);
    expect(useGame.getState().toasts[0]?.text).toBe('two');
  });
});
