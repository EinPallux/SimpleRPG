/**
 * Procedural emblem portraits (GAME_DESIGN.md §3.1): icon × palette × class
 * frame. 12 icons × 12 palettes = 144 combinations; the picker shows a curated
 * 48 (UI_DESIGN.md screen 2). Bots draw from the same pools (M4).
 */
import { z } from 'zod';

export interface EmblemPalette {
  id: number;
  from: string;
  to: string;
}

export const EMBLEM_ICONS: readonly string[] = [
  'warrior',
  'scout',
  'mage',
  'assassin',
  'dragon',
  'wolf',
  'raven',
  'crown',
  'mushroom',
  'oak-leaf',
  'tavern',
  'star',
];

export const EMBLEM_PALETTES: readonly EmblemPalette[] = [
  { id: 0, from: '#8C3B3B', to: '#3B1E1E' },
  { id: 1, from: '#3B6A8C', to: '#1E2E3B' },
  { id: 2, from: '#3B8C57', to: '#1E3B28' },
  { id: 3, from: '#7A3B8C', to: '#321E3B' },
  { id: 4, from: '#8C6E3B', to: '#3B2F1E' },
  { id: 5, from: '#3B8C86', to: '#1E3B39' },
  { id: 6, from: '#5A5F8C', to: '#23253B' },
  { id: 7, from: '#8C3B6E', to: '#3B1E2F' },
  { id: 8, from: '#647A38', to: '#2A331B' },
  { id: 9, from: '#38657A', to: '#1B2B33' },
  { id: 10, from: '#7A5238', to: '#33241B' },
  { id: 11, from: '#4F4F5C', to: '#202027' },
];

export const emblemSpecSchema = z.object({
  icon: z.string().refine((i) => EMBLEM_ICONS.includes(i), 'unknown emblem icon'),
  palette: z
    .number()
    .int()
    .min(0)
    .max(EMBLEM_PALETTES.length - 1),
});
