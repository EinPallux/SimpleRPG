/**
 * Slot-based save API over Dexie (TECHNICAL_ARCHITECTURE.md §4):
 * 3 slots, validated loads, backup rotation as corruption insurance.
 */
import { SAVE_SLOTS } from '@/engine/constants';
import type { GameSave, SlotSummary } from '@/engine/types';
import { db, type SaveRow } from './db';
import { migrateSave } from './migrations';

const BACKUP_MIN_INTERVAL_MS = 5 * 60_000;
const BACKUPS_KEPT_PER_SLOT = 5;

export function isValidSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 1 && slot <= SAVE_SLOTS;
}

function assertSlot(slot: number): void {
  if (!isValidSlot(slot)) throw new Error(`Invalid save slot: ${slot}`);
}

function toSummary(row: SaveRow): SlotSummary {
  return {
    slot: row.slot,
    name: row.summary.name,
    classId: row.summary.classId,
    level: row.summary.level,
    portrait: row.summary.portrait,
    updatedAt: row.updatedAt,
  };
}

/** Summaries for the title screen; index = slot - 1, null = empty slot. */
export async function listSlotSummaries(): Promise<(SlotSummary | null)[]> {
  const rows = await db.saves.toArray();
  const out: (SlotSummary | null)[] = Array.from({ length: SAVE_SLOTS }, () => null);
  for (const row of rows) {
    if (isValidSlot(row.slot)) out[row.slot - 1] = toSummary(row);
  }
  return out;
}

/** Load + forward-migrate + validate. Throws on corruption (caller shows the friendly path). */
export async function loadSlot(slot: number): Promise<GameSave | null> {
  assertSlot(slot);
  const row = await db.saves.get(slot);
  if (!row) return null;
  return migrateSave(row.save);
}

export async function persistSlot(slot: number, save: GameSave): Promise<void> {
  assertSlot(slot);
  const updatedAt = new Date().toISOString();
  const row: SaveRow = {
    slot,
    updatedAt,
    save,
    summary: {
      name: save.hero.name,
      classId: save.hero.classId,
      level: save.hero.level,
      portrait: save.hero.portrait,
    },
  };
  await db.transaction('rw', db.saves, db.backups, async () => {
    await db.saves.put(row);
    const newest = await db.backups.where('slot').equals(slot).reverse().sortBy('at');
    const latest = newest[0];
    if (!latest || Date.parse(updatedAt) - Date.parse(latest.at) >= BACKUP_MIN_INTERVAL_MS) {
      await db.backups.add({ slot, at: updatedAt, save });
      const all = await db.backups.where('slot').equals(slot).sortBy('at');
      const excess = all.length - BACKUPS_KEPT_PER_SLOT;
      if (excess > 0) {
        await db.backups.bulkDelete(all.slice(0, excess).map((b) => b.id!));
      }
    }
  });
}

export async function deleteSlot(slot: number): Promise<void> {
  assertSlot(slot);
  await db.transaction('rw', db.saves, db.backups, db.meta, async () => {
    await db.saves.delete(slot);
    await db.backups.where('slot').equals(slot).delete();
    const active = await db.meta.get('activeSlot');
    if (active?.value === slot) await db.meta.delete('activeSlot');
  });
}

export async function getActiveSlot(): Promise<number | null> {
  const row = await db.meta.get('activeSlot');
  return typeof row?.value === 'number' && isValidSlot(row.value) ? row.value : null;
}

export async function setActiveSlot(slot: number | null): Promise<void> {
  if (slot === null) await db.meta.delete('activeSlot');
  else {
    assertSlot(slot);
    await db.meta.put({ key: 'activeSlot', value: slot });
  }
}

/** Cryptographically random world seed — the one legitimate non-stream randomness (save birth). */
export function randomWorldSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
