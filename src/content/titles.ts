/**
 * Titles (GAME_DESIGN §13): pure prestige. Equip one; it renders after your
 * name on the Character sheet and in your Hall of Fame row.
 * Sources: signature achievements, story chapter finales, arena rank
 * milestones (CONTENT §8 — the gems ship in M4, the titles here).
 */
import { titleSchema, type TitleDef } from './meta';

export const TITLES: readonly TitleDef[] = [
  // — Signature achievements —
  { id: 'the-patient', nameKey: 'title.the-patient', source: 'achievement' },
  { id: 'the-regretful', nameKey: 'title.the-regretful', source: 'achievement' },
  { id: 'the-unbroken', nameKey: 'title.the-unbroken', source: 'achievement' },
  { id: 'the-relentless', nameKey: 'title.the-relentless', source: 'achievement' },
  { id: 'the-completionist', nameKey: 'title.the-completionist', source: 'achievement' },
  { id: 'the-devout', nameKey: 'title.the-devout', source: 'achievement' },
  { id: 'the-affluent', nameKey: 'title.the-affluent', source: 'achievement' },
  { id: 'the-collector', nameKey: 'title.the-collector', source: 'achievement' },
  { id: 'beast-knower', nameKey: 'title.beast-knower', source: 'achievement' },
  { id: 'the-persistent', nameKey: 'title.the-persistent', source: 'achievement' },
  { id: 'the-wayfarer', nameKey: 'title.the-wayfarer', source: 'achievement' },
  { id: 'the-vigilant', nameKey: 'title.the-vigilant', source: 'achievement' },
  { id: 'giant-slayer', nameKey: 'title.giant-slayer', source: 'achievement' },
  { id: 'the-fortunate', nameKey: 'title.the-fortunate', source: 'achievement' },
  { id: 'the-underdog', nameKey: 'title.the-underdog', source: 'achievement' },
  { id: 'the-scholar', nameKey: 'title.the-scholar', source: 'achievement' },
  // — Secrets —
  { id: 'wishful-thinker', nameKey: 'title.wishful-thinker', source: 'secret' },
  { id: 'cat-person', nameKey: 'title.cat-person', source: 'secret' },
  { id: 'the-humbled', nameKey: 'title.the-humbled', source: 'secret' },
  // — Story chapter finales (1..8) —
  { id: 'newly-signed', nameKey: 'title.newly-signed', source: 'story' },
  { id: 'cellar-cleaner', nameKey: 'title.cellar-cleaner', source: 'story' },
  { id: 'well-dressed', nameKey: 'title.well-dressed', source: 'story' },
  { id: 'the-damp', nameKey: 'title.the-damp', source: 'story' },
  { id: 'friend-of-beasts', nameKey: 'title.friend-of-beasts', source: 'story' },
  { id: 'the-rootbreaker', nameKey: 'title.the-rootbreaker', source: 'story' },
  { id: 'glass-climber', nameKey: 'title.glass-climber', source: 'story' },
  { id: 'pale-kings-guest', nameKey: 'title.pale-kings-guest', source: 'story' },
  // — Arena rank milestones —
  { id: 'the-contender', nameKey: 'title.the-contender', source: 'arena' },
  { id: 'the-champion', nameKey: 'title.the-champion', source: 'arena' },
];

export function getTitle(id: string): TitleDef {
  const def = TITLES.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown title: ${id}`);
  return def;
}

export const TITLE_IDS: readonly string[] = TITLES.map((t) => t.id);

export { titleSchema };
