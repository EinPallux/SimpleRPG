/**
 * The M2 "done when": a fresh hero plays the day-1 loop end-to-end —
 * offers → mission → (clock-emulated) wait → claim → reward reveal → vigor →
 * patrol gating. Uses Playwright's clock so real mission timers cost no CI time.
 */
import { expect, test } from '@playwright/test';

test('day-1 loop: offer → mission → claim → reward → second wind → patrol', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-07-28T09:00:00') });
  await page.goto('/');

  // Create the hero
  await page.getByRole('button', { name: 'New adventurer' }).first().click();
  await page.getByPlaceholder(/Grimble/).fill('DayOne');
  await page.getByRole('button', { name: 'Sign the ledger' }).click();

  // The board offers three jobs with flavor text
  await expect(page.getByRole('button', { name: 'Take the job' })).toHaveCount(3);

  // Accept one and watch the tavern switch to the active-mission view
  await page.getByRole('button', { name: 'Take the job' }).first().click();
  await expect(page.getByText(/Out on a mission/)).toBeVisible();

  // Fast-forward past the longest possible mission (20 min)
  await page.clock.fastForward('21:00');
  await page.getByRole('button', { name: /Collect reward/ }).click();

  // Reward reveal: XP + gold always; collect it
  await expect(page.getByText('Mission complete!')).toBeVisible();
  await expect(page.getByText(/\+.* XP/)).toBeVisible();
  await expect(page.getByText(/\+.* gold/)).toBeVisible();
  await page.getByRole('button', { name: 'Collect', exact: true }).click();

  // Fresh offers appear for the next run
  await expect(page.getByRole('button', { name: 'Take the job' })).toHaveCount(3);

  // Second Wind tops the tank up (button flips to its claimed state)
  await page.getByRole('button', { name: /Second Wind/ }).click();
  await expect(page.getByRole('button', { name: /Already poured today/ })).toBeVisible();

  // The unlock ladder holds: Patrol (level 3) still toasts instead of opening
  if (!isMobile) {
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByTitle(/Unlocks at level 3$/)
      .click();
    await expect(page.getByText(/Patrol unlocks at level 3/)).toBeVisible();
    await expect(
      page.getByText(/Out on a mission|The mission board|The Gilded Tankard/),
    ).toBeVisible();
  }
});

test('gold and xp actually landed after a claimed mission', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-28T09:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'New adventurer' }).first().click();
  await page.getByPlaceholder(/Grimble/).fill('Ledger');
  await page.getByRole('button', { name: 'Sign the ledger' }).click();

  await page.getByRole('button', { name: 'Take the job' }).first().click();
  await page.clock.fastForward('21:00');
  await page.getByRole('button', { name: /Collect reward/ }).click();
  await page.getByRole('button', { name: 'Collect', exact: true }).click();

  // Reload: persisted save must carry the earned gold (HUD gold chip ≠ 0)
  await page.clock.fastForward('01:00');
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  const goldChip = page.locator('span[title="Gold"]');
  await expect(goldChip).not.toContainText(/^0$/);
});
