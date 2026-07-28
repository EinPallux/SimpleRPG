/**
 * The Wishing Well (GAME_DESIGN.md §10, odds BALANCING.md §7, rotation
 * CONTENT_CATALOG.md §7): three banners and the deterministic calendar that
 * rotates them. No money, ever (invariant 1) — gems are earned, and the odds
 * are posted on screen, which is why `oddsTable()` is part of the contract and
 * not a UI detail.
 *
 * Everything here is a **pure function of an ISO week number**. The engine owns
 * the clock (invariant 4) and passes the week in; content never asks what day
 * it is. That is also what makes the rotation replayable in the simulator and
 * identical on every device without a server.
 *
 * Rotation (§7): `bannerIndex = ISOweek mod 8` walks the eight L20/L60 class
 * sets, W1 Bulwark → W8 Duskveil, so week 8 lands on index 0. The pet banner
 * runs on its own biweekly two-phase cycle: A = Fernwyrm, B = Moon Calf.
 *
 * Pity, dupes and the featured-set share live in `collectibles.ts`
 * (PITY_EPIC_EVERY, PITY_SET_AT, FEATURED_SET_SHARE, BANNER_PET_SHARE); the
 * rolls themselves are `engine/gacha.ts`'s job.
 *
 * i18n: `banner.{id}.name` + `banner.{id}.blurb`, `well.outcome.{kind}` for the
 * odds table, and `well.line.{0..5}` for the well's own commentary.
 */
import type { BannerDef, BannerId, FrameDef, TossOutcomeKind } from './collectibles';
import { bannerSchema, frameSchema } from './collectibles';
import { classSetAt, getSet } from './sets';

export type { BannerDef, BannerId, FrameDef, TossOutcomeKind };
/** The contracts, re-exported so consumers never reach past this module. */
export { bannerSchema, frameSchema };

/**
 * Odds-table row order, top to bottom — the BALANCING §7 order, worst prize
 * first, so the table reads as a ladder and the 1% legendary sits at the
 * bottom where players look for it.
 */
export const OUTCOME_ORDER: readonly TossOutcomeKind[] = [
  'consumable',
  'rare',
  'epic',
  'setPiece',
  'petEgg',
  'legendary',
];

/**
 * Percentage points of the consumable slot that resolve to a cosmetic portrait
 * frame instead of a bundle, on the banners that carry frames (BALANCING §7,
 * "cosmetic frame — from consumable slot, 3%"). `TossOutcomeKind` has no
 * `frame` member by design: a frame is a *sub-roll inside* the consumable
 * outcome, so the six slots below stay a clean distribution and the engine
 * never needs a seventh branch.
 */
export const CONSUMABLE_FRAME_PP = 3;

/** The banners whose consumable slot can pay a cosmetic frame (§10). */
export const FRAME_BANNERS: readonly BannerId[] = ['featured', 'pet'];

/**
 * The three banners, odds in percent per toss (BALANCING §7). Each column sums
 * to exactly 100 — `gacha.test.ts` enforces it, because the engine rolls a
 * single 0..100 number against this table and a short column would silently
 * bias the last row.
 *
 * The pet banner is the only deviation: it buys its +4pp of pet eggs out of the
 * consumable slot (55 → 52) and the set slot (5 → 4), leaving gear and the
 * legendary line untouched — you trade trinkets for eggs, never power.
 *
 * NUMBERS NOTE: §7 used to print the pet banner's consumable row as 49%, which
 * left that column summing to 97 — 49 is the slot *net of* the 3pp frame
 * sub-roll (49 + 3 = 52). The slot value stored here is 52, the well screen
 * prints "49% bundle · 3% frame" via {@link CONSUMABLE_FRAME_PP}, and §7 was
 * corrected to state the slot and the split separately (see BALANCING §10,
 * 2026-07-28). No intended payout changed; the column just adds up now.
 */
export const BANNERS: readonly BannerDef[] = [
  {
    id: 'standard',
    odds: { consumable: 55, rare: 25, epic: 12, setPiece: 5, petEgg: 2, legendary: 1 },
    nameKey: 'banner.standard.name',
  },
  {
    id: 'featured',
    odds: { consumable: 55, rare: 25, epic: 12, setPiece: 5, petEgg: 2, legendary: 1 },
    nameKey: 'banner.featured.name',
  },
  {
    id: 'pet',
    odds: { consumable: 52, rare: 25, epic: 12, setPiece: 4, petEgg: 6, legendary: 1 },
    nameKey: 'banner.pet.name',
  },
];

/**
 * The featured-set rotation in schedule order, W1..W8 (CONTENT §7). These are
 * the eight L20/L60 class sets from `sets.ts`; the L100 sets and neutrals join
 * once the hero has seen L85 — see FEATURED_ROTATION_LATE, which EXTENDS this
 * list rather than reshuffling it, so a long-running save keeps its weeks.
 */
export const FEATURED_ROTATION: readonly string[] = [
  'bulwark-boar', // W1 — warrior L20
  'thicket-stalker', // W2 — scout L20
  'apprentices-folly', // W3 — mage L20
  'alleycats-guise', // W4 — assassin L20
  'ironroot-sentinel', // W5 — warrior L60
  'galewind-pathfinder', // W6 — scout L60
  'tidebound-scholar', // W7 — mage L60
  'duskveil-shroud', // W8 — assassin L60
];

/** Weeks in one full trip around the featured rotation. */
export const ROTATION_WEEKS = FEATURED_ROTATION.length;
/** The pet banner holds each phase this many weeks (§10: biweekly). */
export const PET_PHASE_WEEKS = 2;

export function getBanner(id: string): BannerDef {
  const def = BANNERS.find((b) => b.id === id);
  if (!def) throw new Error(`Unknown banner: ${id}`);
  return def;
}

/** Floor-mod: total over every integer, including negative or bogus weeks. */
function weekIndex(isoWeekNumber: number, period: number): number {
  const safe = Number.isFinite(isoWeekNumber) ? Math.trunc(isoWeekNumber) : 1;
  // §7 numbers weeks from 1, so W1 must land on rotation slot 0.
  return (((safe - 1) % period) + period) % period;
}

/**
 * The set on rate-up in a given ISO week — `bannerIndex = ISOweek mod 8` read
 * as the §7 schedule (W1 Bulwark … W8 Duskveil, so week 8 → index 0). Total by
 * construction: any integer maps into the eight, so a tampered clock rotates
 * the banner instead of faulting the well.
 */
export function featuredSetForWeek(isoWeekNumber: number): string {
  return FEATURED_ROTATION[weekIndex(isoWeekNumber, ROTATION_WEEKS)]!;
}

/**
 * Which pet the pet banner is focusing this ISO week — phase A (Fernwyrm) for
 * weeks 1–2, phase B (Moon Calf) for 3–4, and so on forever. Matches the
 * `PetSource` `{ kind: 'well'; phase }` tags in `pets.ts`.
 */
export function petPhaseForWeek(isoWeekNumber: number): 'A' | 'B' {
  const halves = Math.floor(weekIndex(isoWeekNumber, PET_PHASE_WEEKS * 2) / PET_PHASE_WEEKS);
  return halves === 0 ? 'A' : 'B';
}

/** One printed row of the always-visible odds table. */
export interface OddsRow {
  kind: TossOutcomeKind;
  /** chance in percent per toss */
  pct: number;
  /** i18n `well.outcome.{kind}` */
  labelKey: string;
}

/**
 * The banner's odds in display order — the ethical-gacha requirement of §10 is
 * that this is always on screen, so it ships as content rather than as a table
 * some screen might forget to render.
 */
export function oddsTable(bannerId: string): readonly OddsRow[] {
  const banner = getBanner(bannerId);
  return OUTCOME_ORDER.map((kind) => ({
    kind,
    pct: banner.odds[kind],
    labelKey: outcomeLabelKey(kind),
  }));
}

/**
 * How the consumable slot splits for display: the bundle share and the cosmetic
 * frame share (0 on the Standard Well, which carries no frames). Sums back to
 * the slot's `odds.consumable`, so the printed table still adds to 100.
 */
export function consumableSplit(bannerId: string): { bundle: number; frame: number } {
  const banner = getBanner(bannerId);
  const frame = FRAME_BANNERS.includes(banner.id) ? CONSUMABLE_FRAME_PP : 0;
  return { bundle: banner.odds.consumable - frame, frame };
}

/** i18n key helpers. */
export function bannerNameKey(id: string): string {
  return `banner.${id}.name`;
}
export function bannerBlurbKey(id: string): string {
  return `banner.${id}.blurb`;
}
export function outcomeLabelKey(kind: TossOutcomeKind): string {
  return `well.outcome.${kind}`;
}

/** Flavor lines the well mutters between tosses (`well.line.{i}`). */
export const WELL_LINE_COUNT = 6;
export function wellLineKey(index: number): string {
  const safe = Number.isFinite(index) ? Math.trunc(index) : 0;
  return `well.line.${((safe % WELL_LINE_COUNT) + WELL_LINE_COUNT) % WELL_LINE_COUNT}`;
}

// ---------------------------------------------------------------------------
// The late rotation and tier auto-select (CONTENT §7)
// ---------------------------------------------------------------------------

/**
 * The six that join the rotation the first time the hero reaches L85 — the four
 * L100 class sets and the two neutrals (§7: "rotation then extends to 14").
 * They EXTEND the base eight rather than reshuffling them, so a long-running
 * save keeps seeing its familiar weeks in their familiar order.
 */
export const FEATURED_ROTATION_LATE: readonly string[] = [
  'aegis-molten-king', // W9  — warrior L100
  'eyes-silent-wood', // W10 — scout L100
  'regalia-hollow-star', // W11 — mage L100
  'masque-pale-king', // W12 — assassin L100
  'innkeepers-regalia', // W13 — neutral L40
  'twilight-wanderer', // W14 — neutral L85
];

/** Reaching this level once extends the rotation from 8 weeks to 14 (§7). */
export const ROTATION_EXTEND_LEVEL = 85;
export const ROTATION_WEEKS_EXTENDED = FEATURED_ROTATION.length + FEATURED_ROTATION_LATE.length;

export function featuredRotation(extended: boolean): readonly string[] {
  return extended ? [...FEATURED_ROTATION, ...FEATURED_ROTATION_LATE] : FEATURED_ROTATION;
}

/**
 * The scheduled set for an ISO week on the extended (post-L85) rotation. The
 * base-rotation weeks keep their slots, so W1 is still Bulwark either way.
 */
export function featuredSetForWeekExtended(isoWeekNumber: number): string {
  return featuredRotation(true)[weekIndex(isoWeekNumber, ROTATION_WEEKS_EXTENDED)]!;
}

/** The tiers a class line offers, before and after the rotation extends. */
const TIERS_BASE = [20, 60] as const;
const TIERS_EXTENDED = [20, 60, 100] as const;

/**
 * What the Featured banner actually shows a given hero.
 *
 * §7: "Featured banner auto-selects the set *tier* nearest (player level + 10)".
 * The week picks the class LINE; the hero's level picks which rung of that line
 * is on rate-up — so a L55 warrior in Bulwark week chases Ironroot Sentinel
 * instead of a L20 set they outgrew thirty levels ago. Neutral sets have no
 * line to walk and are featured exactly as scheduled.
 *
 * Ties go to the LOWER tier: gear you can nearly wear beats gear you cannot,
 * and it keeps the choice deterministic instead of order-dependent.
 */
export function featuredSetForHero(isoWeekNumber: number, heroLevel: number): string {
  const extended = heroLevel >= ROTATION_EXTEND_LEVEL;
  const scheduledId = extended
    ? featuredSetForWeekExtended(isoWeekNumber)
    : featuredSetForWeek(isoWeekNumber);
  const scheduled = getSet(scheduledId);
  if (scheduled.classId === null) return scheduledId;

  const target = heroLevel + 10;
  const tiers = extended ? TIERS_EXTENDED : TIERS_BASE;
  let best: 20 | 60 | 100 = tiers[0];
  for (const tier of tiers) {
    if (Math.abs(tier - target) < Math.abs(best - target)) best = tier;
  }
  return classSetAt(best, scheduled.classId).id;
}

// ---------------------------------------------------------------------------
// Cosmetic portrait frames (CONTENT §7 — 12 frames)
// ---------------------------------------------------------------------------

/**
 * Eight frames ship with a base-rotation featured set, so every one of the
 * eight weeks has a cosmetic to chase; four sit in the general pool and can
 * drop on any frame-carrying banner. A frame is pure decoration around the
 * portrait and carries no stats *by design* — it is the one prize the balance
 * model never has to hear about, which is what lets it be the rarest-feeling
 * thing in the well without costing the pacing contract anything.
 */
export const FRAMES: readonly FrameDef[] = [
  { id: 'boarhide-braid', setId: 'bulwark-boar', nameKey: 'frame.boarhide-braid' },
  { id: 'bramble-weave', setId: 'thicket-stalker', nameKey: 'frame.bramble-weave' },
  { id: 'chalk-sigil', setId: 'apprentices-folly', nameKey: 'frame.chalk-sigil' },
  { id: 'gutter-gilt', setId: 'alleycats-guise', nameKey: 'frame.gutter-gilt' },
  { id: 'ironroot-knot', setId: 'ironroot-sentinel', nameKey: 'frame.ironroot-knot' },
  { id: 'galewind-quill', setId: 'galewind-pathfinder', nameKey: 'frame.galewind-quill' },
  { id: 'tideglass-rim', setId: 'tidebound-scholar', nameKey: 'frame.tideglass-rim' },
  { id: 'duskveil-lace', setId: 'duskveil-shroud', nameKey: 'frame.duskveil-lace' },
  { id: 'tavern-brass', setId: null, nameKey: 'frame.tavern-brass' },
  { id: 'wishing-stone', setId: null, nameKey: 'frame.wishing-stone' },
  { id: 'pressed-fern', setId: null, nameKey: 'frame.pressed-fern' },
  { id: 'motheaten-velvet', setId: null, nameKey: 'frame.motheaten-velvet' },
];

export const FRAME_IDS: readonly string[] = FRAMES.map((f) => f.id);

export function getFrame(id: string): FrameDef {
  const def = FRAMES.find((f) => f.id === id);
  if (!def) throw new Error(`Unknown frame: ${id}`);
  return def;
}

/** The frame that ships with a featured set, or null when it has none. */
export function frameForSet(setId: string): FrameDef | null {
  return FRAMES.find((f) => f.setId === setId) ?? null;
}

/** Frames with no set attached — always eligible on a frame-carrying banner. */
export const GENERAL_FRAMES: readonly FrameDef[] = FRAMES.filter((f) => f.setId === null);

export function frameNameKey(id: string): string {
  return `frame.${id}`;
}
