/**
 * The Wheel of Destiny (GAME_DESIGN.md §14, CONTENT_CATALOG.md §11):
 * 12 slots, weights /100. Payout magnitudes in BALANCING §4.6.
 * Lorenzo the Improbable narrates; his lines live in i18n `wheel.bark.*`.
 */
import { z } from 'zod';

export type WheelSlotKind =
  | 'goldS'
  | 'goldM'
  | 'goldL'
  | 'xp'
  | 'item'
  | 'scraps'
  | 'treats'
  | 'dust'
  | 'gem'
  | 'mystery'
  | 'jackpot'
  | 'salute';

export interface WheelSlot {
  kind: WheelSlotKind;
  weight: number; // /100
  labelKey: string;
}

export const WHEEL_SLOTS: readonly WheelSlot[] = [
  { kind: 'goldS', weight: 20, labelKey: 'wheel.slot.goldS' },
  { kind: 'goldM', weight: 12, labelKey: 'wheel.slot.goldM' },
  { kind: 'goldL', weight: 5, labelKey: 'wheel.slot.goldL' },
  { kind: 'xp', weight: 15, labelKey: 'wheel.slot.xp' },
  { kind: 'item', weight: 10, labelKey: 'wheel.slot.item' },
  { kind: 'scraps', weight: 12, labelKey: 'wheel.slot.scraps' },
  { kind: 'treats', weight: 8, labelKey: 'wheel.slot.treats' },
  { kind: 'dust', weight: 6, labelKey: 'wheel.slot.dust' },
  { kind: 'gem', weight: 8, labelKey: 'wheel.slot.gem' },
  { kind: 'mystery', weight: 2, labelKey: 'wheel.slot.mystery' },
  { kind: 'jackpot', weight: 1, labelKey: 'wheel.slot.jackpot' },
  { kind: 'salute', weight: 1, labelKey: 'wheel.slot.salute' },
];

export const wheelSlotSchema = z
  .object({
    kind: z.enum([
      'goldS',
      'goldM',
      'goldL',
      'xp',
      'item',
      'scraps',
      'treats',
      'dust',
      'gem',
      'mystery',
      'jackpot',
      'salute',
    ]),
    weight: z.number().int().positive(),
    labelKey: z.string(),
  })
  .strict();
