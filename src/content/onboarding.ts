/**
 * The scripted first fifteen minutes (GAME_DESIGN.md §17) and the contextual
 * tours that follow it.
 *
 * The whole sequence is DATA. Each step names the screen it belongs to, the
 * element it points at, and the condition that finishes it — so the runtime
 * (`engine/onboarding.ts`) never contains a list of special cases, and a
 * designer can re-order the first day by editing this file.
 *
 * Two rules the shape enforces:
 *  1. **Nothing here blocks input outside its own anchor** (UI_DESIGN §5.3).
 *     A coach mark is a spotlight and a sentence, never a modal cage.
 *  2. **Every step is skippable in one click**, and skipping grants the exact
 *     same rewards (§17, "I've been here before"), so the tutorial can never be
 *     the reason one hero is behind another.
 */
import { z } from 'zod';

/** What finishes a step — read as a pure condition against the save. */
export type OnboardingGoal =
  /** the player did the thing (a stat-ledger counter passed a threshold) */
  | { kind: 'metric'; metric: string; target: number }
  /** purely informational: the player pressed "Got it" */
  | { kind: 'acknowledge' };

export interface OnboardingStep {
  id: string;
  /** the screen this step lives on; the runtime deep-links there */
  screen: string;
  /**
   * CSS selector-ish anchor id the CoachMark spotlights, or null for a centred
   * card with no anchor (the cold open, the town reveal).
   */
  anchor: string | null;
  goal: OnboardingGoal;
  /** i18n `ob.{id}.title` + `ob.{id}.body` */
  nameKey: string;
}

/**
 * §17's six beats, expanded into the steps a player actually clicks through.
 * Beat 2 (name + class) is the Create screen and happens before a save exists,
 * so it is not a step here — the sequence starts the moment the hero lands.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  // — 1. Cold open: the cart, the road, the innkeeper's wave —
  {
    id: 'cold-open',
    screen: 'tavern',
    anchor: null,
    goal: { kind: 'acknowledge' },
    nameKey: 'ob.cold-open',
  },
  // — 3. The first mission, guided —
  {
    id: 'first-mission',
    screen: 'tavern',
    anchor: 'tavern-offers',
    goal: { kind: 'metric', metric: 'missionsCompleted', target: 1 },
    nameKey: 'ob.first-mission',
  },
  {
    id: 'first-equip',
    screen: 'character',
    anchor: 'character-backpack',
    goal: { kind: 'acknowledge' },
    nameKey: 'ob.first-equip',
  },
  // — 4. The infinite sink, explained once, in front of the button —
  {
    id: 'first-attribute',
    screen: 'character',
    anchor: 'character-attrs',
    goal: { kind: 'metric', metric: 'attrsBought', target: 1 },
    nameKey: 'ob.first-attribute',
  },
  // — 5. Krellbor the Overconfident —
  {
    id: 'first-arena',
    screen: 'arena',
    anchor: 'arena-offers',
    goal: { kind: 'metric', metric: 'arenaFights', target: 1 },
    nameKey: 'ob.first-arena',
  },
  // — 6. The town opens up; the ballad takes over from here —
  {
    id: 'town-reveal',
    screen: 'tavern',
    anchor: null,
    goal: { kind: 'acknowledge' },
    nameKey: 'ob.town-reveal',
  },
];

/** `progress.onboarding.step` equals this once the town has been revealed. */
export const ONBOARDING_DONE = ONBOARDING_STEPS.length;

export function getOnboardingStep(index: number): OnboardingStep | null {
  return ONBOARDING_STEPS[index] ?? null;
}

export function onboardingTitleKey(id: string): string {
  return `ob.${id}.title`;
}
export function onboardingBodyKey(id: string): string {
  return `ob.${id}.body`;
}

export const onboardingStepSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    screen: z.string(),
    anchor: z.string().nullable(),
    goal: z.union([
      z.object({ kind: z.literal('metric'), metric: z.string(), target: z.number().positive() }),
      z.object({ kind: z.literal('acknowledge') }),
    ]),
    nameKey: z.string(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Contextual tours (§17: "each later system unlock triggers a 15-second tour")
// ---------------------------------------------------------------------------

/**
 * One per screen that has something non-obvious to say the first time you open
 * it. Keyed by `ScreenId`; a screen with no entry simply never tours, which is
 * the right answer for the ones that explain themselves.
 *
 * i18n `tour.{screen}` — a single paragraph, warm and short. These are NOT
 * gates: the tour is dismissible and the screen is fully usable behind it.
 */
export const TOUR_SCREENS: readonly string[] = [
  'patrol',
  'arena',
  'shops',
  'forge',
  'dungeons',
  'expeditions',
  'wheel',
  'quests',
  'achievements',
  'codex',
  'calendar',
  'hallOfFame',
  'stable',
  'menagerie',
  'well',
];

export function tourKey(screen: string): string {
  return `tour.${screen}`;
}

export function hasTour(screen: string): boolean {
  return TOUR_SCREENS.includes(screen);
}
