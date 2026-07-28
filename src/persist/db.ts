/** Dexie database (TECHNICAL_ARCHITECTURE.md §4): saves per slot, backup rotation, meta. */
import Dexie, { type EntityTable } from 'dexie';
import type { ClassId, EmblemSpec, GameSave } from '@/engine/types';

export interface SaveRow {
  slot: number;
  updatedAt: string;
  save: GameSave;
  summary: { name: string; classId: ClassId; level: number; portrait: EmblemSpec };
}

export interface BackupRow {
  id?: number;
  slot: number;
  at: string;
  save: GameSave;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export const db = new Dexie('simplerpg') as Dexie & {
  saves: EntityTable<SaveRow, 'slot'>;
  backups: EntityTable<BackupRow, 'id'>;
  meta: EntityTable<MetaRow, 'key'>;
};

db.version(1).stores({
  saves: 'slot',
  backups: '++id, slot',
  meta: 'key',
});
