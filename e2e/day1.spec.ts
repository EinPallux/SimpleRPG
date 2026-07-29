/**
 * The M2 "done when": a fresh hero plays the day-1 loop end-to-end —
 * offers → mission → (clock-emulated) wait → claim → reward reveal → vigor →
 * patrol gating. Uses Playwright's clock so real mission timers cost no CI time.
 */
import { expect, test, type Page } from '@playwright/test';

/**
 * Sit through the end-of-mission fight and land on the reward panel.
 *
 * Every mission ends in a scrap with something local (B1), so the reveal opens
 * on combat playback and only then pays out. `Skip` jumps to the end of the
 * replay; `Continue` closes it. Both are part of the flow a real player walks.
 */
async function watchTheFight(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.count()) await skip.click();
  await page.getByRole('button', { name: /Continue|Done/ }).last().click();
}


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

  // M8: a genuinely fresh hero lands on the cold open (GAME_DESIGN §17 beat 1).
  // This spec is the one place a hero is created through the UI, so it is also
  // the honest place to prove the first thing a new player ever sees.
  await expect(page.getByText(/Your cart gave out on the road/)).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();

  // The board offers three jobs with flavor text
  await expect(page.getByRole('button', { name: 'Take the job' })).toHaveCount(3);

  // Accept one and watch the tavern switch to the active-mission view
  await page.getByRole('button', { name: 'Take the job' }).first().click();
  await expect(page.getByText(/Out on a mission/)).toBeVisible();

  // Fast-forward past the longest possible mission (20 min)
  await page.clock.fastForward('21:00');
  await page.getByRole('button', { name: /Collect reward/ }).click();

  // The scrap on the way home comes first, then the payout.
  await watchTheFight(page);

  // Reward reveal: XP + gold always; collect it
  await expect(page.getByText('Mission complete!')).toBeVisible();
  // `.first()`: the fight's bonus line quotes gold and XP too, so both
  // patterns legitimately match twice now.
  await expect(page.getByText(/\+.* XP/).first()).toBeVisible();
  await expect(page.getByText(/\+.* gold/).first()).toBeVisible();
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
  await page.getByRole('button', { name: 'Got it' }).click(); // cold open (§17)

  await page.getByRole('button', { name: 'Take the job' }).first().click();
  await page.clock.fastForward('21:00');
  await page.getByRole('button', { name: /Collect reward/ }).click();
  await watchTheFight(page);
  await page.getByRole('button', { name: 'Collect', exact: true }).click();

  // Reload: persisted save must carry the earned gold (HUD gold chip ≠ 0)
  await page.clock.fastForward('01:00');
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  const goldChip = page.locator('span[title="Gold"]');
  await expect(goldChip).not.toContainText(/^0$/);
});
