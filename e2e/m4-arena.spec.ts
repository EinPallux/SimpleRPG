/**
 * M4 "done when": the simulated-PvP loop is playable — arena offers, a fight
 * with playback, honor movement, cooldown, and a living Hall of Fame with
 * inspectable people. The crafted save's persisted rng streams make the fight
 * outcome predictable with the same engine code the app runs.
 */
import { expect, test } from '@playwright/test';
import { fightArena, getArenaOffers } from '../src/engine/arena';
import { botLadder, playerRank, worldDayIndex } from '../src/engine/botworld';
import { createNewSave, deriveEmblem } from '../src/engine/newSave';
import { TOUR_SCREENS } from '../src/content/onboarding';
import { skipOnboarding } from '../src/engine/onboarding';
import type { GameSave } from '../src/engine/types';
import { encodeSave } from '../src/persist/codec';

const CREATED = '2026-07-28T08:00:00';
const CLOCK = '2026-07-28T09:00:00';

function craftSave(): GameSave {
  const save = createNewSave(
    {
      name: 'Gladys',
      classId: 'warrior',
      emblem: deriveEmblem('Gladys', 'warrior'),
      worldSeed: 'ab'.repeat(16),
    },
    Date.parse(CREATED),
  );
  save.hero.level = 15; // Hall of Fame unlocks at 15 (arena at 5)
  save.hero.attrsBought = { str: 90, dex: 30, int: 10, con: 70, lck: 30 };
  // These fixtures are established heroes, not first-timers, so they are
  // past the scripted first run (GAME_DESIGN §17) — otherwise the cold-open
  // coach mark sits over the screen every spec is trying to drive.
  skipOnboarding(save);
  // …and they have already read every screen's first-visit tour, so the tip
  // card is not sitting over the controls each spec is here to drive.
  save.progress.toursSeen = [...TOUR_SCREENS];
  return save;
}

test('arena day: offers → peek → fight playback → cooldown → Hall of Fame', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'exercises the desktop rail; mobile nav is covered by day1/smoke specs');

  const save = craftSave();
  const code = encodeSave(save);
  const nowMs = Date.parse(CLOCK);

  // Predict the whole bout with the same engine + streams the app will use.
  const probe = structuredClone(save);
  const offers = getArenaOffers(probe, nowMs, { stance: false });
  const firstOffer = offers[0]!;
  const outcome = fightArena(probe, 0, nowMs);
  const expectedHonorLine = `${outcome.honorDelta >= 0 ? '+' : '−'}${Math.abs(outcome.honorDelta)} honor`;
  const expectedRank = playerRank(probe, nowMs);
  const topBot = botLadder(save.worldSeed, worldDayIndex(save, nowMs))[0]!;

  await page.clock.install({ time: new Date(CLOCK) });
  await page.goto('/');

  await page.getByRole('button', { name: 'Import save' }).first().click();
  await page.getByPlaceholder('SRPG1.…').fill(code);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('The Gilded Tankard')).toBeVisible();

  const rail = page.getByRole('navigation', { name: 'Main' });

  // Arena: three offers on the board, ten pips ready
  await rail.getByRole('button', { name: 'Arena' }).click();
  await expect(page.getByRole('heading', { name: 'The Arena' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bouts left today: 10/10' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fight' })).toHaveCount(3);

  // Profile peek from the offer card: a person, not a stat block
  await page.getByTitle(firstOffer.bot.name).click();
  const peek = page.getByRole('dialog', { name: firstOffer.bot.name });
  await expect(peek.getByText('Attributes')).toBeVisible();
  await expect(peek.getByText('Equipment')).toBeVisible();
  await expect(peek.getByText('Honor, last two weeks')).toBeVisible();
  await peek.getByRole('button', { name: 'Close' }).click();

  // Fight the predicted bout; fake timers never fire, so Skip drives playback
  await page.getByRole('button', { name: 'Fight' }).first().click();
  const playback = page.getByRole('dialog', { name: `Gladys vs ${firstOffer.bot.name}` });
  await expect(playback).toBeVisible();
  await playback.getByRole('button', { name: 'Skip' }).click();
  await expect(playback.getByText(/wins!$/)).toBeVisible();
  await expect(playback.getByText(expectedHonorLine)).toBeVisible();
  await expect(playback.getByText(`You now stand at rank ${expectedRank}.`)).toBeVisible();
  await playback.getByRole('button', { name: 'Continue' }).click();

  // One pip spent, cooldown running, buttons resting
  await expect(page.getByRole('img', { name: 'Bouts left today: 9/10' })).toBeVisible();
  await expect(page.getByText(/Catch your breath/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fight' }).first()).toBeDisabled();

  // Hall of Fame: your row, the summit, and a searchable realm
  await rail.getByRole('button', { name: 'Hall of Fame' }).click();
  await expect(page.getByRole('heading', { name: 'Hall of Fame' })).toBeVisible();
  await expect(
    page.getByText(`Your standing: rank ${expectedRank} · ${probe.hero.honor} honor`),
  ).toBeVisible();
  await page.getByRole('button', { name: 'To me' }).click();
  await expect(page.getByText('You', { exact: true })).toBeVisible();

  // Search the reigning rank 1 and open their profile
  await page.getByPlaceholder('Search names or guilds…').fill(topBot.name);
  const row = page.getByRole('button', { name: new RegExp(`Rank 1: `) });
  await expect(row).toBeVisible();
  await row.click();
  await expect(
    page.getByRole('dialog', { name: topBot.name }).getByText('Attributes'),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: topBot.name })
    .getByRole('button', { name: 'Close' })
    .click();

  // Reload: the arena day survives (fights spent, honor banked)
  await page.clock.fastForward('00:05');
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await rail.getByRole('button', { name: 'Arena' }).click();
  await expect(page.getByRole('img', { name: 'Bouts left today: 9/10' })).toBeVisible();
});
