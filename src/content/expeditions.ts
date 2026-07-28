/**
 * Expeditions (GAME_DESIGN.md §16): the choice-driven vigor spend. Four
 * locales with dedicated art, 5 encounters of 3 revealed cards each,
 * heroism → chest tier. Numbers in BALANCING §4.6.
 */
import { z } from 'zod';

export interface LocaleDef {
  id: string;
  nameKey: string;
  /** mission_background_{n} asset index (CONTENT §3: bg 1/2/3/9) */
  bg: number;
  /** the locale's mini-boss (encounter 3 option), i18n `miniboss.{slug}.*` */
  minibossSlug: string;
}

export const LOCALES: readonly LocaleDef[] = [
  { id: 'castaway-cove', nameKey: 'locale.castaway-cove', bg: 1, minibossSlug: 'captain-flotsam' },
  { id: 'crystal-ruins', nameKey: 'locale.crystal-ruins', bg: 2, minibossSlug: 'crystal-curator' },
  { id: 'watchmans-rest', nameKey: 'locale.watchmans-rest', bg: 3, minibossSlug: 'sergeant-nap' },
  { id: 'pinewatch', nameKey: 'locale.pinewatch', bg: 9, minibossSlug: 'pinewatch-impostor' },
];

export const localeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    nameKey: z.string(),
    bg: z.number().int().min(1).max(14),
    minibossSlug: z.string().regex(/^[a-z0-9-]+$/),
  })
  .strict();

export function getLocale(id: string): LocaleDef {
  const def = LOCALES.find((l) => l.id === id);
  if (!def) throw new Error(`Unknown locale: ${id}`);
  return def;
}

/**
 * Event vignettes (CONTENT §13: 24, choose-1-of-2). The reward shape each
 * option pays is data; the words live in i18n under `exped.event.{i}.*`.
 * `bold` options risk more for more (variance handled in the engine roll).
 */
export interface EventOption {
  /** 'gold' pays ×M10 fractions · 'xp' pays ×M10-XP fractions · 'heroism' pays flat */
  reward: 'gold' | 'xp' | 'heroism' | 'nothing';
  /** magnitude: gold/xp = fraction of a 10-vigor mission; heroism = flat points */
  amount: number;
  /** extra heroism every option grants for participating */
  heroism: number;
}

export interface EventDef {
  index: number;
  safe: EventOption;
  bold: EventOption;
}

/** 24 events; safe ≈ small sure thing, bold ≈ bigger swing (engine adds ±). */
export const EVENTS: readonly EventDef[] = Array.from({ length: 24 }, (_, index) => {
  // Deterministic variety by index — the words in i18n make each one distinct.
  const mod = index % 4;
  const safe: EventOption =
    mod === 0
      ? { reward: 'gold', amount: 0.3, heroism: 3 }
      : mod === 1
        ? { reward: 'xp', amount: 0.25, heroism: 3 }
        : mod === 2
          ? { reward: 'heroism', amount: 2, heroism: 3 }
          : { reward: 'gold', amount: 0.25, heroism: 4 };
  const bold: EventOption =
    mod === 0
      ? { reward: 'xp', amount: 0.55, heroism: 4 }
      : mod === 1
        ? { reward: 'gold', amount: 0.65, heroism: 4 }
        : mod === 2
          ? { reward: 'nothing', amount: 0, heroism: 7 }
          : { reward: 'heroism', amount: 4, heroism: 4 };
  return { index, safe, bold };
});

export const eventSchema = z
  .object({
    index: z.number().int().min(0).max(23),
    safe: z
      .object({
        reward: z.enum(['gold', 'xp', 'heroism', 'nothing']),
        amount: z.number(),
        heroism: z.number(),
      })
      .strict(),
    bold: z
      .object({
        reward: z.enum(['gold', 'xp', 'heroism', 'nothing']),
        amount: z.number(),
        heroism: z.number(),
      })
      .strict(),
  })
  .strict();
