/**
 * M5 "done when": the active pillars play — a dungeon wall fight with boss
 * intro and rewards, the Wheel of Destiny's daily spins, and an expedition
 * embarkation with predicted cards. The crafted save's persisted rng streams
 * let the spec compute every outcome with the same engine the app runs.
 */
import { expect, test, type Page } from '@playwright/test';
import { attemptFloor } from '../src/engine/dungeons';
import { ensureCards, startExpedition } from '../src/engine/expeditions';
import { getTavernOffers } from '../src/engine/missions';
import { createNewSave, deriveEmblem } from '../src/engine/newSave';
import { TOUR_SCREENS } from '../src/content/onboarding';
import { skipOnboarding } from '../src/engine/onboarding';
import { spinWheel } from '../src/engine/wheel';
import type { ExpeditionCard, GameSave } from '../src/engine/types';
import { encodeSave } from '../src/persist/codec';

const CREATED = '2026-07-28T08:00:00';
const CLOCK = '2026-07-28T09:00:00';

function craftSave(): GameSave {
  const save = createNewSave(
    {
      name: 'Brunhild',
      classId: 'warrior',
      emblem: deriveEmblem('Brunhild', 'warrior'),
      worldSeed: 'be'.repeat(16),
    },
    Date.parse(CREATED),
  );
  save.hero.level = 15; // dungeons at 12, expeditions at 8, wheel at 5
  save.hero.attrsBought = { str: 400, dex: 150, int: 40, con: 300, lck: 150 };
  save.hero.gold = 50_000;
  // These fixtures are established heroes, not first-timers, so they are
  // past the scripted first run (GAME_DESIGN §17) — otherwise the cold-open
  // coach mark sits over the screen every spec is trying to drive.
  skipOnboarding(save);
  // …and they have already read every screen's first-visit tour, so the tip
  // card is not sitting over the controls each spec is here to drive.
  save.progress.toursSeen = [...TOUR_SCREENS];
  return save;
}

async function importSave(page: Page, code: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import save' }).first().click();
  await page.getByPlaceholder('SRPG1.…').fill(code);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('The Gilded Tankard')).toBeVisible();
}

function cardButtonName(card: ExpeditionCard): string | RegExp {
  if (card.kind === 'fight' || card.kind === 'miniboss') return 'Fight';
  if (card.kind === 'treasure') return 'Open';
  return /./; // events expose their two option labels instead
}

test('active pillars: dungeon wall → wheel spin → expedition embark', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'exercises the desktop rail; mobile nav is covered by day1/smoke specs');

  const save = craftSave();
  const code = encodeSave(save);
  const nowMs = Date.parse(CLOCK);

  // Probe: replay the app's exact stream order on a clone.
  const probe = structuredClone(save);
  getTavernOffers(probe); // the tavern screen rolls its board on first paint
  const dungeonOut = attemptFloor(probe, 'rat-cellars', nowMs);
  expect(dungeonOut.won).toBe(true); // 400 STR flattens a L14 rat
  const wheelOut = spinWheel(probe);
  startExpedition(probe, 'castaway-cove');
  const cards = ensureCards(probe);

  await page.clock.install({ time: new Date(CLOCK) });
  await importSave(page, code);
  const rail = page.getByRole('navigation', { name: 'Main' });

  // — Dungeons: Squeaker the Bold makes his introduction and his exit —
  await rail.getByTitle('Dungeons').click();
  await expect(page.getByRole('heading', { name: 'The Dungeons' })).toBeVisible();
  await expect(
    page.getByText('I have bitten larger ankles than yours. Present them.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fight', exact: true }).click();
  const playback = page.getByRole('dialog', { name: 'Brunhild vs Squeaker the Bold' });
  await expect(playback).toBeVisible();
  await playback.getByRole('button', { name: 'Skip' }).click();
  await expect(playback.getByText(/Floor 1 cleared/)).toBeVisible();
  await expect(playback.getByText(`+${dungeonOut.gems}`, { exact: true })).toBeVisible();
  await playback.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/Next attempt in/).first()).toBeVisible();

  // — The Wheel: one free spin, honestly rigged —
  await rail.getByTitle('Wheel of Destiny').click();
  await expect(page.getByRole('heading', { name: 'The Wheel of Destiny' })).toBeVisible();
  await expect(page.getByText('The odds, posted honestly')).toBeVisible();
  await page.getByRole('button', { name: /Spin/ }).click();
  await page.clock.fastForward('00:04'); // the pointer settles
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  // The free spin is spent; the next one quotes gold.
  await expect(page.getByRole('button', { name: /Spin/ })).toContainText('🪙');
  void wheelOut; // the probe keeps the streams aligned for the expedition below

  // — Expeditions: embark (Castaway Cove is the first locale card) —
  await rail.getByTitle('Expeditions').click();
  await expect(page.getByRole('heading', { name: 'Expeditions' })).toBeVisible();
  await page.getByRole('button', { name: 'Embark' }).first().click();
  await expect(page.getByText('Encounter 1/5')).toBeVisible();
  await expect(page.getByText(/Heroism · /)).toBeVisible();
  for (const card of cards) {
    if (card.kind === 'event') continue; // its two option labels render instead
    await expect(page.getByRole('button', { name: cardButtonName(card) }).first()).toBeVisible();
  }

  // Resolve the first non-event card (the seed guarantees one exists).
  const targetIdx = cards.findIndex((c) => c.kind !== 'event');
  expect(targetIdx).toBeGreaterThanOrEqual(0);
  const target = cards[targetIdx]!;
  const label = target.kind === 'treasure' ? 'Open' : 'Fight';
  const nth = cards
    .slice(0, targetIdx)
    .filter(
      (c) => (c.kind === 'treasure' ? 'Open' : c.kind === 'event' ? '' : 'Fight') === label,
    ).length;
  await page.getByRole('button', { name: label, exact: true }).nth(nth).click();
  if (target.kind === 'treasure') {
    await expect(page.getByText(/\+\d+ heroism/)).toBeVisible();
    await page.getByRole('button', { name: 'Onward' }).click();
  } else {
    const fightDialog = page.getByRole('dialog', { name: /Brunhild vs/ });
    await fightDialog.getByRole('button', { name: 'Skip' }).click();
    await fightDialog.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(page.getByText('Encounter 2/5')).toBeVisible();

  // Walk away — the run clears, the day's tally stands.
  await page.getByRole('button', { name: 'Abandon run' }).click();
  await expect(page.getByText(/The run is abandoned/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Embark' }).first()).toBeVisible();

  // — Reload: cooldowns, floors and spins all survive —
  await page.clock.fastForward('00:05');
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await rail.getByTitle('Dungeons').click();
  await expect(page.getByText('Floor 1/10').first()).toBeVisible();
  await expect(page.getByText(/Next attempt in/).first()).toBeVisible();
});
