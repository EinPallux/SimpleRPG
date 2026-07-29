/**
 * The 375 px floor (CLAUDE.md definition of done: "works at 375 px").
 *
 * Nothing tested it. The `mobile` project runs a Pixel 7 at **412 px**, so the
 * narrowest common phone — iPhone SE / 12 mini / 13 mini, still a real share of
 * handsets — was never exercised, and 37 px is exactly the margin a two-column
 * grid or a wide number eats. This spec drives every screen at 375×667 and
 * fails on the one thing a narrow layout does wrong: pushing the page sideways.
 *
 * It also covers the two surfaces M9 added (the Codex's named legendaries and
 * the Tavern's tip line), which are the newest chances to have got it wrong.
 */
import { expect, test, type Page } from '@playwright/test';
import { ONBOARDING_DONE, TOUR_SCREENS } from '../src/content/onboarding';
import { UNIQUES } from '../src/content/uniques';
import { generateUnique } from '../src/engine/items';
import { createNewSave, deriveEmblem } from '../src/engine/newSave';
import { skipOnboarding } from '../src/engine/onboarding';
import { Rng, seedState } from '../src/engine/rng';
import type { GameSave } from '../src/engine/types';
import { encodeSave } from '../src/persist/codec';

const CREATED = '2026-07-28T08:00:00';
const CLOCK = '2026-07-28T09:00:00';

/** The narrowest width the project promises to support, in CSS pixels. */
const NARROW = { width: 375, height: 667 };

test.use({ viewport: NARROW });

/**
 * A hero far enough along that every door is open, holding two named
 * legendaries — the Codex page reads differently for found vs unfound entries
 * and both states need to fit.
 */
function craftSave(): GameSave {
  const save = createNewSave(
    {
      name: 'Narrow',
      classId: 'warrior',
      emblem: deriveEmblem('Narrow', 'warrior'),
      worldSeed: 'n375'.repeat(8),
    },
    Date.parse(CREATED),
  );
  save.hero.level = 60;
  save.hero.attrsBought = { str: 900, dex: 200, int: 60, con: 700, lck: 250 };
  save.hero.gold = 5_000_000; // long numbers are their own layout hazard
  save.hero.gems = 999;
  save.hero.scraps = 4321;
  save.hero.dust = 876;
  save.hero.treats = 1234;
  save.progress.onboarding.step = ONBOARDING_DONE;
  save.progress.toursSeen = [...TOUR_SCREENS];
  skipOnboarding(save);

  const rng = new Rng(seedState('narrow', 'loot'));
  save.inventory.equipped.amulet = generateUnique('gilded-iou', 60, rng);
  save.inventory.backpack.push(generateUnique('crown-of-the-understudy', 60, rng));
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

/**
 * The page body must never scroll sideways. Individual wide things (a table, a
 * combat log) are allowed their own `overflow-x` container — this measures the
 * document, which is what the user actually feels as "broken".
 */
async function expectNoSideScroll(page: Page, where: string) {
  const doc = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(doc.scroll, `${where} pushes the page sideways at 375 px`).toBeLessThanOrEqual(doc.client);
}

/**
 * Every screen, with the tab-bar group that opens it (ui/nav.ts NAV_GROUPS) and
 * a heading to prove it painted. Group 'Adventure' hides behind the "More" tab:
 * its headline entry (Tavern) is the direct tab, so it has no button of its own.
 */
const SCREENS: readonly { group: string; nav: string; marker: string }[] = [
  { group: 'More', nav: 'Expeditions', marker: 'Expeditions' },
  { group: 'More', nav: 'Patrol', marker: 'City Watch' },
  { group: 'Combat', nav: 'Arena', marker: 'The Arena' },
  { group: 'Combat', nav: 'Dungeons', marker: 'The Dungeons' },
  { group: 'Combat', nav: 'Hall of Fame', marker: 'Hall of Fame' },
  { group: 'Town', nav: 'Shops', marker: 'Weapon Smith' },
  { group: 'Town', nav: 'Forge', marker: 'Upgrade bench' },
  { group: 'Town', nav: 'Stable', marker: 'The Stable' },
  { group: 'Town', nav: 'Menagerie', marker: 'The Menagerie' },
  { group: 'Town', nav: 'Wishing Well', marker: 'The odds, posted by the bucket' },
  { group: 'Town', nav: 'Wheel of Destiny', marker: 'The odds, posted honestly' },
  { group: 'Hero', nav: 'Character', marker: 'Equipment' },
  { group: 'Hero', nav: 'Quests', marker: 'The Quest Board' },
  { group: 'Hero', nav: 'Achievements', marker: 'Achievements' },
  { group: 'Hero', nav: 'Codex', marker: 'The Codex' },
  { group: 'Hero', nav: 'Calendar', marker: "The Innkeeper's Calendar" },
];

async function gotoScreen(page: Page, group: string, nav: string) {
  await page.getByRole('button', { name: group, exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: nav, exact: true }).click();
  await expect(sheet).toBeHidden();
}

test('375 px: no screen pushes the page sideways', async ({ page }) => {
  await page.clock.setFixedTime(new Date(CLOCK));
  await importSave(page, craftSave());
  await expectNoSideScroll(page, 'tavern');

  for (const screen of SCREENS) {
    await gotoScreen(page, screen.group, screen.nav);
    // Matched as text inside <main>, not as a heading role: most screens title
    // themselves through a Panel rather than an <h1> (the a11y spec logs that as
    // a known moderate finding), and the desktop rail — display:none here, but
    // still in the DOM — carries the same words.
    await expect(
      page.getByRole('main').getByText(screen.marker, { exact: true }).first(),
    ).toBeVisible();
    await expectNoSideScroll(page, screen.nav);
  }
});

test('375 px: the M9 surfaces fit — named legendaries and the daily tip', async ({ page }) => {
  await page.clock.setFixedTime(new Date(CLOCK));
  await importSave(page, craftSave());

  // The tip line sits on the Tavern and must be readable, not clipped.
  const tip = page.getByText(/^Tip:/);
  await expect(tip).toBeVisible();
  await expectNoSideScroll(page, 'tavern with tip');

  // The Codex lists all eight: two found (named), six still rumours.
  await gotoScreen(page, 'Hero', 'Codex');
  await page.getByRole('button', { name: 'Armory' }).click();
  await expect(page.getByRole('main').getByText('Named legendaries')).toBeVisible();
  await expect(page.getByText('2 of 8 found')).toBeVisible();
  await expect(page.getByText('The Gilded IOU', { exact: true })).toBeVisible();
  await expect(page.getByText('Crown of the Understudy', { exact: true })).toBeVisible();
  // …and the six unfound ones read as rumours rather than blanks.
  await expect(page.getByText('Not yet found')).toHaveCount(UNIQUES.length - 2);
  await expectNoSideScroll(page, 'codex armory');
});
