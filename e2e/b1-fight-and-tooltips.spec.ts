/**
 * The two things B1 added that a player interacts with directly: the fight
 * every mission now ends in, and the tooltips that finally explain the numbers.
 *
 * Both are easy to break silently — a fight that never renders still pays out,
 * and a tooltip that never opens leaves the game exactly as unexplained as it
 * was — so they get a spec rather than a screenshot.
 */
import { expect, test, type Page } from '@playwright/test';
import { ONBOARDING_DONE, TOUR_SCREENS } from '../src/content/onboarding';
import { generateItem } from '../src/engine/items';
import { createNewSave, deriveEmblem } from '../src/engine/newSave';
import { skipOnboarding } from '../src/engine/onboarding';
import { Rng, seedState } from '../src/engine/rng';
import type { GameSave } from '../src/engine/types';
import { encodeSave } from '../src/persist/codec';

const CLOCK = '2026-07-28T09:00:00';

/**
 * Let the screen stop moving before pointing at it.
 *
 * Panels and cards animate in (B1), so for the first few hundred milliseconds
 * after a navigation the thing under test is still sliding. Playwright aims the
 * mouse at where an element is *now*; if it is mid-transform the pointer lands
 * beside it, no `pointerenter` fires, and the tooltip never opens — a failure
 * that reproduces only on a loaded machine. Infinite animations (the attention
 * pulses) never finish and are excluded.
 */
async function settle(page: Page) {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter((a) => (a.effect?.getComputedTiming().iterations ?? 1) !== Infinity)
        .every((a) => a.playState !== 'running'),
    undefined,
    { timeout: 5000 },
  );
}

function craftSave(): GameSave {
  const save = createNewSave(
    {
      name: 'Scrapper',
      classId: 'warrior',
      emblem: deriveEmblem('Scrapper', 'warrior'),
      worldSeed: 'b1fx'.repeat(8),
    },
    Date.parse('2026-07-28T08:00:00'),
  );
  save.hero.level = 20;
  save.hero.attrsBought = { str: 200, dex: 60, int: 20, con: 160, lck: 60 };
  save.hero.gold = 50_000;
  save.progress.onboarding.step = ONBOARDING_DONE;
  save.progress.toursSeen = [...TOUR_SCREENS];
  skipOnboarding(save);

  // One piece cut for another class, so the off-class advice has something to
  // say — nothing is class-LOCKED any more, so this must read as a warning and
  // never as a refusal.
  const rng = new Rng(seedState('b1fx', 'loot'));
  save.inventory.backpack.push(
    generateItem({ ilvl: 22, rarity: 'rare', slot: 'chest', classId: 'mage' }, rng),
  );
  return save;
}

async function importSave(page: Page, save: GameSave) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import save' }).first().click();
  await page.getByPlaceholder('SRPG1.…').fill(encodeSave(save));
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('The Gilded Tankard')).toBeVisible();
}

test('a mission ends in a fight, and the fight pays on top of the job', async ({ page }) => {
  await page.clock.install({ time: new Date(CLOCK) });
  await importSave(page, craftSave());

  await page.getByRole('button', { name: 'Take the job' }).first().click();
  await page.clock.fastForward('21:00');
  await page.getByRole('button', { name: /Collect reward/ }).click();

  // The scrap comes first: two fighters, HP bars, a round counter.
  const bout = page.getByRole('dialog', { name: /vs/ });
  await expect(bout).toBeVisible();
  await expect(bout.getByText(/Round/)).toBeVisible();
  await expect(bout.getByRole('progressbar')).toHaveCount(2);

  // Skipping jumps to the verdict rather than skipping the outcome.
  await bout.getByRole('button', { name: 'Skip' }).click();
  await expect(bout.getByText(/You saw it off|It got the better of you/)).toBeVisible();

  // …and then the payout, which arrives whether the scrap went well or not.
  await bout.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Mission complete!')).toBeVisible();
  await expect(page.getByText(/\+.* gold/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Collect', exact: true }).click();
});

test('backpack items explain themselves on hover, and off-class is advice not a lock', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'hover is the mechanism under test; touch has its own long-press path');
  await page.clock.setFixedTime(new Date(CLOCK));
  await importSave(page, craftSave());

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'Character' })
    .click();
  await page.getByRole('button', { name: 'Backpack' }).click();

  // Located by its rarity frame rather than by name: item names are generated,
  // so any name pattern here would be a guess about the loot roller.
  const cell = page.locator('button[class*="frame-slot--"]').first();
  await settle(page);
  await cell.hover();

  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip.getByText(/Item level/)).toBeVisible();
  await expect(tip.getByText(/Sells for/)).toBeVisible();
  // The class cut is a warning with a number on it, not a refusal.
  await expect(tip.getByText(/Cut for a Mage/)).toBeVisible();
  await expect(tip.getByText(/will do you any good/)).toBeVisible();

  // The item is still equippable — that is the whole point of the change.
  await cell.click();
  await expect(page.getByRole('button', { name: 'Equip', exact: true })).toBeEnabled();
});

test('attributes explain where their number came from', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover is the mechanism under test');
  await page.clock.setFixedTime(new Date(CLOCK));
  await importSave(page, craftSave());

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'Character' })
    .click();
  await settle(page);
  await page.getByText('Strength', { exact: true }).hover();

  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip.getByText('Your class')).toBeVisible();
  await expect(tip.getByText('Bought with gold')).toBeVisible();
  await expect(tip.getByText('Total')).toBeVisible();
});

/**
 * The chrome explains itself too.
 *
 * The purse and the rail were the last two surfaces still running on `title`
 * attributes — four currencies nobody had ever been told the purpose of, and
 * twenty doors whose only description was their own name. Both are now real
 * tooltips, which means both can be asserted.
 */
test('the purse and the rail explain themselves', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover is the mechanism under test; touch has its own long-press path');
  await page.clock.setFixedTime(new Date(CLOCK));
  await importSave(page, craftSave());
  await settle(page);

  // A currency: what it buys, the exact balance, and where it comes from.
  await page.getByRole('group', { name: 'Gems' }).hover();
  const purse = page.getByRole('tooltip');
  await expect(purse).toBeVisible();
  await expect(purse.getByText(/never once been for sale/)).toBeVisible();
  await expect(purse.getByText('You have')).toBeVisible();
  await expect(purse.getByText(/Never from money/)).toBeVisible();

  // A rail entry: what is behind the door, before walking through it.
  const rail = page.getByRole('navigation', { name: 'Main' });
  await rail.getByRole('button', { name: 'Forge', exact: true }).hover();
  await expect(page.getByText(/One bench makes a piece of gear better/)).toBeVisible();

  // …and a locked one says so in the tooltip, not just in a padlock glyph.
  await rail.getByRole('button', { name: /Menagerie — unlocks at level 35/ }).hover();
  await expect(page.getByText('Unlocks at level 35')).toBeVisible();
});
