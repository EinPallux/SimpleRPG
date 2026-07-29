/**
 * Wishing Well validation (GAME_DESIGN.md §10, odds BALANCING.md §7, rotation
 * CONTENT_CATALOG.md §7). Two things here are load-bearing: every odds column
 * must sum to exactly 100 (the engine rolls one number against the table), and
 * the rotation must be a total, period-8 pure function of the ISO week — no
 * clock, no server, identical on every device.
 */
import { describe, expect, it } from 'vitest';
import { hasKey } from '@/i18n';
import type { TossOutcomeKind } from './collectibles';
import { bannerSchema as sharedSchema, frameSchema as sharedFrameSchema } from './collectibles';
import { getSet, SETS } from './sets';
import {
  BANNERS,
  bannerBlurbKey,
  bannerNameKey,
  bannerSchema,
  consumableSplit,
  CONSUMABLE_FRAME_PP,
  featuredRotation,
  featuredSetForHero,
  featuredSetForWeek,
  featuredSetForWeekExtended,
  FEATURED_ROTATION,
  FEATURED_ROTATION_LATE,
  FRAME_BANNERS,
  frameForSet,
  frameNameKey,
  frameSchema,
  FRAMES,
  FRAME_IDS,
  GENERAL_FRAMES,
  getBanner,
  getFrame,
  oddsTable,
  outcomeLabelKey,
  OUTCOME_ORDER,
  petPhaseForWeek,
  PET_PHASE_WEEKS,
  ROTATION_EXTEND_LEVEL,
  ROTATION_WEEKS,
  ROTATION_WEEKS_EXTENDED,
  WELL_LINE_COUNT,
  wellLineKey,
} from './gacha';

const KINDS: readonly TossOutcomeKind[] = [
  'consumable',
  'rare',
  'epic',
  'setPiece',
  'petEgg',
  'legendary',
];
const SET_IDS = new Set(SETS.map((s) => s.id));

describe('wishing well banners (M7)', () => {
  it('offers exactly three banners with the canonical ids', () => {
    expect(BANNERS).toHaveLength(3);
    expect(BANNERS.map((b) => b.id)).toEqual(['standard', 'featured', 'pet']);
    expect(new Set(BANNERS.map((b) => b.id)).size).toBe(3);
  });

  it('validates every banner against the shared schema', () => {
    for (const banner of BANNERS) expect(() => bannerSchema.parse(banner)).not.toThrow();
    // the re-export is the one contract from collectibles.ts, not a copy
    expect(bannerSchema).toBe(sharedSchema);
    expect(() => bannerSchema.parse({ ...BANNERS[0]!, id: 'seasonal' })).toThrow();
    expect(() => bannerSchema.parse({ ...BANNERS[0]!, pity: 10 })).toThrow();
  });

  it('sums every odds column to exactly 100 (BALANCING §7)', () => {
    for (const banner of BANNERS) {
      const total = KINDS.reduce((sum, kind) => sum + banner.odds[kind], 0);
      expect(total).toBe(100);
    }
  });

  it('quotes the canonical odds per banner', () => {
    expect(getBanner('standard').odds).toEqual({
      consumable: 55,
      rare: 25,
      epic: 12,
      setPiece: 5,
      petEgg: 2,
      legendary: 1,
    });
    expect(getBanner('featured').odds).toEqual(getBanner('standard').odds);
    // §7 prints the pet bundle as 49% — that is the slot net of the 3pp frame
    // sub-roll (49 + 3 = 52), which is what makes the column reach 100.
    expect(getBanner('pet').odds).toEqual({
      consumable: 52,
      rare: 25,
      epic: 12,
      setPiece: 4,
      petEgg: 6,
      legendary: 1,
    });
    // the pet banner buys its eggs from consumables and set pieces only
    const std = getBanner('standard').odds;
    const pet = getBanner('pet').odds;
    expect(pet.petEgg - std.petEgg).toBe(4);
    expect(std.consumable - pet.consumable + (std.setPiece - pet.setPiece)).toBe(4);
    expect(pet.rare).toBe(std.rare);
    expect(pet.epic).toBe(std.epic);
    expect(pet.legendary).toBe(std.legendary);
  });

  it('splits the consumable slot into bundle + cosmetic frame (§7)', () => {
    expect(CONSUMABLE_FRAME_PP).toBe(3);
    expect(FRAME_BANNERS).toEqual(['featured', 'pet']);
    for (const banner of BANNERS) {
      const split = consumableSplit(banner.id);
      expect(split.bundle + split.frame).toBe(banner.odds.consumable);
      expect(split.bundle).toBeGreaterThan(0);
      expect(split.frame).toBe(FRAME_BANNERS.includes(banner.id) ? CONSUMABLE_FRAME_PP : 0);
    }
    // the printed numbers the design docs quote
    expect(consumableSplit('standard')).toEqual({ bundle: 55, frame: 0 });
    expect(consumableSplit('featured')).toEqual({ bundle: 52, frame: 3 });
    expect(consumableSplit('pet')).toEqual({ bundle: 49, frame: 3 });
    expect(() => consumableSplit('anniversary')).toThrow(/Unknown banner/);
  });

  it('keys every odds row to a real outcome kind, with no strays', () => {
    for (const banner of BANNERS) {
      const keys = Object.keys(banner.odds);
      expect(keys).toHaveLength(KINDS.length);
      for (const key of keys) expect(KINDS).toContain(key as TossOutcomeKind);
      for (const kind of KINDS) {
        expect(banner.odds[kind]).toBeGreaterThan(0);
        expect(Number.isInteger(banner.odds[kind])).toBe(true);
      }
    }
  });

  it('looks banners up by id and throws on unknown ones', () => {
    for (const banner of BANNERS) expect(getBanner(banner.id)).toBe(banner);
    expect(() => getBanner('anniversary')).toThrow(/Unknown banner/);
  });

  it('prints an ordered odds table for the always-visible UI (§10)', () => {
    expect(OUTCOME_ORDER).toEqual(KINDS);
    for (const banner of BANNERS) {
      const rows = oddsTable(banner.id);
      expect(rows.map((r) => r.kind)).toEqual(OUTCOME_ORDER);
      expect(rows.reduce((sum, r) => sum + r.pct, 0)).toBe(100);
      for (const row of rows) {
        expect(row.pct).toBe(banner.odds[row.kind]);
        expect(row.labelKey).toBe(outcomeLabelKey(row.kind));
        expect(hasKey(row.labelKey)).toBe(true);
      }
    }
    expect(() => oddsTable('anniversary')).toThrow(/Unknown banner/);
  });

  it('rotates eight real sets, in the CONTENT §7 schedule order', () => {
    expect(ROTATION_WEEKS).toBe(8);
    expect(FEATURED_ROTATION).toHaveLength(8);
    expect(new Set(FEATURED_ROTATION).size).toBe(8);
    expect(FEATURED_ROTATION).toEqual([
      'bulwark-boar',
      'thicket-stalker',
      'apprentices-folly',
      'alleycats-guise',
      'ironroot-sentinel',
      'galewind-pathfinder',
      'tidebound-scholar',
      'duskveil-shroud',
    ]);
    for (const id of FEATURED_ROTATION) expect(SET_IDS.has(id)).toBe(true);
  });

  it('maps W1..W8 to Bulwark..Duskveil, with week 8 on rotation index 0', () => {
    for (let week = 1; week <= 8; week++) {
      expect(featuredSetForWeek(week)).toBe(FEATURED_ROTATION[week - 1]);
    }
    expect(featuredSetForWeek(1)).toBe('bulwark-boar');
    expect(featuredSetForWeek(8)).toBe('duskveil-shroud');
    expect(featuredSetForWeek(9)).toBe('bulwark-boar');
  });

  it('cycles the featured set with period 8 and is total over any week', () => {
    for (let week = 0; week <= 20; week++) {
      const id = featuredSetForWeek(week);
      expect(SET_IDS.has(id)).toBe(true);
      expect(FEATURED_ROTATION).toContain(id);
      expect(featuredSetForWeek(week + ROTATION_WEEKS)).toBe(id);
      expect(featuredSetForWeek(week + 1)).not.toBe(id);
    }
    // a full turn visits every set exactly once
    const cycle = [1, 2, 3, 4, 5, 6, 7, 8].map(featuredSetForWeek);
    expect(new Set(cycle).size).toBe(8);
    // hostile inputs rotate the banner rather than faulting the well
    expect(SET_IDS.has(featuredSetForWeek(-3))).toBe(true);
    expect(SET_IDS.has(featuredSetForWeek(0))).toBe(true);
    expect(SET_IDS.has(featuredSetForWeek(9_999))).toBe(true);
    expect(SET_IDS.has(featuredSetForWeek(Number.NaN))).toBe(true);
  });

  it('flips the pet phase every two weeks and only ever answers A or B', () => {
    expect(PET_PHASE_WEEKS).toBe(2);
    expect(petPhaseForWeek(1)).toBe('A');
    expect(petPhaseForWeek(2)).toBe('A');
    expect(petPhaseForWeek(3)).toBe('B');
    expect(petPhaseForWeek(4)).toBe('B');
    expect(petPhaseForWeek(5)).toBe('A');
    for (let week = -8; week <= 40; week++) {
      const phase = petPhaseForWeek(week);
      expect(['A', 'B']).toContain(phase);
      // holds for the second week of the phase, flips on the next pair
      expect(petPhaseForWeek(week + 2 * PET_PHASE_WEEKS)).toBe(phase);
      expect(petPhaseForWeek(week + PET_PHASE_WEEKS)).not.toBe(phase);
    }
    expect(petPhaseForWeek(Number.NaN)).toBe('A');
  });

  it('names and describes every banner in i18n', () => {
    for (const banner of BANNERS) {
      expect(banner.nameKey).toBe(bannerNameKey(banner.id));
      expect(hasKey(banner.nameKey)).toBe(true);
      expect(hasKey(bannerBlurbKey(banner.id))).toBe(true);
    }
    const keys = BANNERS.flatMap((b) => [bannerNameKey(b.id), bannerBlurbKey(b.id)]);
    expect(new Set(keys).size).toBe(6);
  });

  it('gives the well six things to say and wraps the index safely', () => {
    expect(WELL_LINE_COUNT).toBe(6);
    for (let i = 0; i < WELL_LINE_COUNT; i++) {
      expect(wellLineKey(i)).toBe(`well.line.${i}`);
      expect(hasKey(wellLineKey(i))).toBe(true);
    }
    expect(wellLineKey(6)).toBe('well.line.0');
    expect(wellLineKey(-1)).toBe('well.line.5');
    expect(hasKey(wellLineKey(Number.NaN))).toBe(true);
  });
});

describe('the extended rotation (CONTENT §7, post-L85)', () => {
  it('adds the four L100 sets and the two neutrals without reshuffling', () => {
    expect(ROTATION_EXTEND_LEVEL).toBe(85);
    expect(FEATURED_ROTATION_LATE).toHaveLength(6);
    expect(ROTATION_WEEKS_EXTENDED).toBe(14);
    for (const id of FEATURED_ROTATION_LATE) expect(SET_IDS.has(id)).toBe(true);
    // disjoint from the base eight, and the base weeks keep their slots
    for (const id of FEATURED_ROTATION_LATE) expect(FEATURED_ROTATION).not.toContain(id);
    expect(featuredRotation(false)).toEqual(FEATURED_ROTATION);
    expect(featuredRotation(true).slice(0, 8)).toEqual([...FEATURED_ROTATION]);
    expect(new Set(featuredRotation(true)).size).toBe(14);
  });

  it('cycles the extended schedule with period 14 and stays total', () => {
    expect(featuredSetForWeekExtended(1)).toBe('bulwark-boar');
    expect(featuredSetForWeekExtended(9)).toBe('aegis-molten-king');
    expect(featuredSetForWeekExtended(14)).toBe('twilight-wanderer');
    expect(featuredSetForWeekExtended(15)).toBe('bulwark-boar');
    for (let week = -5; week <= 30; week++) {
      const id = featuredSetForWeekExtended(week);
      expect(SET_IDS.has(id)).toBe(true);
      expect(featuredSetForWeekExtended(week + ROTATION_WEEKS_EXTENDED)).toBe(id);
    }
    expect(SET_IDS.has(featuredSetForWeekExtended(Number.NaN))).toBe(true);
  });

  it('auto-selects the tier nearest level + 10, ties to the lower rung (§7)', () => {
    // week 1 is the warrior line: L20 Bulwark → L60 Ironroot → L100 Aegis
    expect(featuredSetForHero(1, 5)).toBe('bulwark-boar');
    expect(featuredSetForHero(1, 30)).toBe('bulwark-boar'); // target 40: exact tie → lower
    expect(featuredSetForHero(1, 31)).toBe('ironroot-sentinel');
    expect(featuredSetForHero(1, 55)).toBe('ironroot-sentinel');
    expect(featuredSetForHero(1, 84)).toBe('ironroot-sentinel'); // still pre-extension
    expect(featuredSetForHero(1, 85)).toBe('aegis-molten-king'); // target 95 → L100
    // the week picks the class line, the level picks the rung
    expect(featuredSetForHero(3, 55)).toBe('tidebound-scholar'); // mage week
    expect(featuredSetForHero(4, 10)).toBe('alleycats-guise'); // assassin week
  });

  it('never features a set the hero cannot have unlocked the rotation for', () => {
    for (let week = 1; week <= 14; week++) {
      for (const level of [1, 20, 60, 84]) {
        const id = featuredSetForHero(week, level);
        const set = getSet(id);
        expect(set.classId).not.toBeNull();
        expect([20, 60]).toContain(set.level);
      }
    }
  });

  it('features neutral sets exactly as scheduled — they have no tier ladder', () => {
    expect(featuredSetForHero(13, 90)).toBe('innkeepers-regalia');
    expect(featuredSetForHero(14, 120)).toBe('twilight-wanderer');
    expect(getSet(featuredSetForHero(13, 90)).classId).toBeNull();
  });
});

describe('cosmetic portrait frames (CONTENT §7)', () => {
  it('ships twelve frames with unique kebab-case ids', () => {
    expect(FRAMES).toHaveLength(12);
    expect(FRAME_IDS).toEqual(FRAMES.map((f) => f.id));
    expect(new Set(FRAME_IDS).size).toBe(12);
    for (const id of FRAME_IDS) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('validates against the shared schema and rejects malformed frames', () => {
    for (const frame of FRAMES) expect(() => frameSchema.parse(frame)).not.toThrow();
    expect(frameSchema).toBe(sharedFrameSchema);
    expect(() => frameSchema.parse({ ...FRAMES[0]!, id: 'Boarhide Braid' })).toThrow();
    expect(() => frameSchema.parse({ ...FRAMES[0]!, tier: 2 })).toThrow();
  });

  it('gives every base-rotation week one exclusive frame, plus four general ones', () => {
    const attached = FRAMES.filter((f) => f.setId !== null);
    expect(attached).toHaveLength(8);
    expect(GENERAL_FRAMES).toHaveLength(4);
    expect(attached.map((f) => f.setId)).toEqual([...FEATURED_ROTATION]);
    for (const setId of FEATURED_ROTATION) {
      expect(SET_IDS.has(setId)).toBe(true);
      expect(frameForSet(setId)).not.toBeNull();
    }
    // one frame per set, never two
    expect(new Set(attached.map((f) => f.setId)).size).toBe(8);
    expect(frameForSet('aegis-molten-king')).toBeNull();
    expect(frameForSet('nope')).toBeNull();
  });

  it('looks frames up by id, throws on unknown ones, and names them all', () => {
    for (const frame of FRAMES) {
      expect(getFrame(frame.id)).toBe(frame);
      expect(frame.nameKey).toBe(frameNameKey(frame.id));
      expect(hasKey(frame.nameKey)).toBe(true);
    }
    expect(() => getFrame('golden-arena-frame')).toThrow(/Unknown frame/);
  });
});
