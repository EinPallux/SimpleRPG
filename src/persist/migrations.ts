/**
 * Save migrations (invariant 9: saves migrate forward, never wipe).
 * Each entry upgrades version N-1 → N. `migrateSave` walks a raw object up to
 * SAVE_VERSION, then zod-validates. Every future entry ships a fixture test in
 * `migrations.test.ts` alongside the schema bump.
 */
import { SAVE_VERSION } from '@/engine/constants';
import type { GameSave } from '@/engine/types';
import { parseGameSave } from './schema';

type RawSave = Record<string, unknown>;

const MIGRATIONS: Record<number, (raw: RawSave) => RawSave> = {
  // 2: (raw) => ({ ...raw, version: 2, /* new fields with defaults */ }),
};

export function migrateSave(raw: unknown): GameSave {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Save data is not an object.');
  }
  let working = { ...(raw as RawSave) };
  let version = Number(working.version);
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version + 1];
    if (!step) throw new Error(`No migration path from save version ${version}.`);
    working = step(working);
    version = Number(working.version);
  }
  return parseGameSave(working);
}
