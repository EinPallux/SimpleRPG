/**
 * E2E smoke (TECHNICAL_ARCHITECTURE.md §9): create hero → themed shell →
 * reload → IndexedDB persistence → continue. Runs on desktop + mobile projects.
 */
import { expect, test } from '@playwright/test';

test('create a hero, see the shell, survive a reload', async ({ page }) => {
  await page.goto('/');

  // Title screen with the framed slot cards
  await expect(page.getByRole('heading', { name: 'SimpleRPG' })).toBeVisible();

  // Create flow
  await page.getByRole('button', { name: 'New adventurer' }).first().click();
  await page.getByPlaceholder(/Grimble/).fill('Playwright');
  await page.getByRole('button', { name: /Scout/ }).click();
  await page.getByRole('button', { name: 'Sign the ledger' }).click();

  // Shell: HUD identity + tavern placeholder + frame system stylesheet applied
  await expect(page.getByText('Playwright')).toBeVisible();
  await expect(page.getByText('The Gilded Tankard')).toBeVisible();
  const borderImage = await page
    .locator('section.frame-primary')
    .first()
    .evaluate((el) => getComputedStyle(el).borderImageSource);
  expect(borderImage).toContain('/assets/frames/');

  // Reload → title offers Continue for the persisted hero → back into the shell
  await page.reload();
  await expect(page.getByText('Playwright')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('The Gilded Tankard')).toBeVisible();
});

test('locked navigation toasts instead of navigating', async ({ page, isMobile }) => {
  test.skip(isMobile, 'rail is desktop-only; mobile uses group sheets');
  await page.goto('/');
  await page.getByRole('button', { name: 'New adventurer' }).first().click();
  await page.getByPlaceholder(/Grimble/).fill('Lockcheck');
  await page.getByRole('button', { name: 'Sign the ledger' }).click();
  await expect(page.getByText('The Gilded Tankard')).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: /unlocks at level 5/i })
    .first()
    .click();
  // The toast, specifically: the rail entry's own tooltip is open behind it
  // (the click focused the trigger) and says "Unlocks at level 5" too.
  await expect(page.getByText('Arena unlocks at level 5.')).toBeVisible();
  await expect(page.getByText('The Gilded Tankard')).toBeVisible();
});
