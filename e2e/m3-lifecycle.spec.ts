/**
 * M3 "done when": the full item lifecycle is playable — shop → backpack →
 * equip → attribute purchase → forge upgrade → elixir. Uses a deterministic
 * crafted save imported through the real UI; because rng streams live in the
 * save, the spec can predict the shop stock with the same engine code.
 */
import { expect, test } from '@playwright/test';
import { canEquip } from '../src/engine/inventoryOps';
import { shopPrice } from '../src/engine/items';
import { createNewSave, deriveEmblem } from '../src/engine/newSave';
import { TOUR_SCREENS } from '../src/content/onboarding';
import { skipOnboarding } from '../src/engine/onboarding';
import { getShopStock } from '../src/engine/shops';
import type { GameSave } from '../src/engine/types';
import { encodeSave } from '../src/persist/codec';

function craftSave(): GameSave {
  const save = createNewSave(
    {
      name: 'Richie',
      classId: 'warrior',
      emblem: deriveEmblem('Richie', 'warrior'),
      worldSeed: 'f'.repeat(32),
    },
    Date.parse('2026-07-28T08:00:00'),
  );
  save.hero.level = 15; // Forge unlocks at 15 (shops at 10, Arcanum at 12)
  save.hero.gold = 500_000;
  save.hero.scraps = 30;
  // These fixtures are established heroes, not first-timers, so they are
  // past the scripted first run (GAME_DESIGN §17) — otherwise the cold-open
  // coach mark sits over the screen every spec is trying to drive.
  skipOnboarding(save);
  // …and they have already read every screen's first-visit tour, so the tip
  // card is not sitting over the controls each spec is here to drive.
  save.progress.toursSeen = [...TOUR_SCREENS];
  return save;
}

test('item lifecycle: import → shop → equip → attributes → forge → elixir', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'exercises the desktop rail; mobile nav is covered by day1/smoke specs');

  const save = craftSave();
  // Predict the weaponsmith stock with the same engine + seed the app will use.
  const probe = structuredClone(save);
  const stock = getShopStock(probe, 'weaponsmith');
  const buyIdx = stock.findIndex((i) => i && canEquip(probe, i) && shopPrice(i) <= 400_000);
  expect(buyIdx).toBeGreaterThanOrEqual(0);
  const code = encodeSave(save);

  await page.clock.install({ time: new Date('2026-07-28T09:00:00') });
  await page.goto('/');

  // Import the crafted hero through the real save-code flow
  await page.getByRole('button', { name: 'Import save' }).first().click();
  await page.getByPlaceholder('SRPG1.…').fill(code);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('The Gilded Tankard')).toBeVisible();

  const rail = page.getByRole('navigation', { name: 'Main' });

  // Shop: buy the predicted piece; learn its display name from the toast
  await rail.getByTitle('Shops').click();
  const buyButtons = page.getByRole('button', { name: /^Buy · / });
  await expect(buyButtons.first()).toBeVisible();
  await buyButtons.nth(buyIdx).click();
  const toast = page.getByText(/^Bought .+\.$/);
  await expect(toast).toBeVisible();
  const boughtName = (await toast.innerText()).slice('Bought '.length, -1);

  // Backpack: open the item and equip it
  await rail.getByTitle('Character').click();
  await page.getByRole('button', { name: /Backpack \(1\)/ }).click();
  await page.getByRole('button', { name: boughtName, exact: true }).click();
  await page.getByRole('button', { name: 'Equip', exact: true }).click();
  await page.getByRole('button', { name: 'Equipment', exact: true }).click();
  // By accessible name, not `title`: an item cell carries a real tooltip now
  // (B1), so its name lives on `aria-label` where a screen reader can find it.
  await expect(page.getByRole('button', { name: boughtName, exact: true })).toBeVisible();

  // Attributes: the infinite sink accepts its first coin
  await page.getByRole('button', { name: '+', exact: true }).first().click();
  await expect(page.getByText('Strength increased to 1.')).toBeVisible();

  // Forge: strike the anvil on the equipped piece
  await rail.getByTitle('Forge').click();
  await page.getByRole('button', { name: boughtName, exact: true }).first().click();
  await page.getByRole('button', { name: 'Strike the anvil' }).click();
  await expect(page.getByText(/shines a little brighter/)).toBeVisible();

  // Arcanum: drink something that hums
  await rail.getByTitle('Shops').click();
  await page.getByRole('button', { name: 'The Arcanum' }).click();
  await page.getByRole('button', { name: /Minor Elixir of Strength/ }).click();
  await expect(page.getByText(/kicking in/)).toBeVisible();

  // Reload: the whole state survives (equipped piece + potion socket).
  // The fake clock must tick past the 1s autosave debounce first.
  await page.clock.fastForward('00:05');
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await rail.getByTitle('Character').click();
  await expect(
    page.getByRole('button', { name: new RegExp(`^${boughtName.replace(/[+]/g, '\\+')}`) }),
  ).toBeVisible();
  await expect(page.getByText(/Minor Elixir of Strength · /)).toBeVisible();
});
