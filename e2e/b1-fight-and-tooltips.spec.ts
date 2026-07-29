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
  await expect(
    bout.getByText(/You saw it off|It got the better of you/),
  ).toBeVisible();

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

  await page.getByRole('navigation', { name: 'Main' }).getByTitle('Character').click();
  await page.getByRole('button', { name: 'Backpack' }).click();

  // Located by its rarity frame rather than by name: item names are generated,
  // so any name pattern here would be a guess about the loot roller.
  const cell = page.locator('button[class*="frame-slot--"]').first();
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

  await page.getByRole('navigation', { name: 'Main' }).getByTitle('Character').click();
  await page.getByText('Strength', { exact: true }).hover();

  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip.getByText('Your class')).toBeVisible();
  await expect(tip.getByText('Bought with gold')).toBeVisible();
  await expect(tip.getByText('Total')).toBeVisible();
});
