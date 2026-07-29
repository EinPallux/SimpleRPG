/**
 * The accessibility gate (TECHNICAL_ARCHITECTURE.md §8: "axe in Playwright · no
 * serious violations on core screens"), plus the promises of UI_DESIGN §7/§8
 * that axe cannot see for itself — text scaling to 125% without clipping, calm
 * under reduced motion, a visible focus ring, and hit areas of at least 44 px.
 *
 * The crafted hero is level 40 with the sequence and every contextual tour
 * already marked seen: a coach mark is its own surface with its own audit, and
 * one drifting over the screen under test would leave this spec measuring the
 * tutorial instead of the game.
 *
 * The clock is pinned with `setFixedTime` rather than `install` — axe-core runs
 * its own timers, and a frozen event loop would hang the audit rather than
 * steady it.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ONBOARDING_DONE, TOUR_SCREENS } from '../src/content/onboarding';
import { createNewSave, deriveEmblem } from '../src/engine/newSave';
import { skipOnboarding } from '../src/engine/onboarding';
import type { GameSave } from '../src/engine/types';
import { encodeSave } from '../src/persist/codec';

const CREATED = '2026-07-28T08:00:00';
const CLOCK = '2026-07-28T09:00:00';

/** UI_DESIGN §8 / §4.4 — the touch floor, in CSS pixels. */
const TAP_MIN = 44;

type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

/** Level 40 opens every audited door; the tours are pre-seen (see file note). */
function craftSave(): GameSave {
  const save = createNewSave(
    {
      name: 'Auditor',
      classId: 'warrior',
      emblem: deriveEmblem('Auditor', 'warrior'),
      worldSeed: 'a11y'.repeat(8),
    },
    Date.parse(CREATED),
  );
  save.hero.level = 40;
  save.hero.attrsBought = { str: 400, dex: 150, int: 40, con: 300, lck: 150 };
  save.hero.gold = 80_000;
  save.hero.gems = 120;
  save.progress.onboarding.step = ONBOARDING_DONE;
  save.progress.toursSeen = [...TOUR_SCREENS];
  // These fixtures are established heroes, not first-timers, so they are
  // past the scripted first run (GAME_DESIGN §17) — otherwise the cold-open
  // coach mark sits over the screen every spec is trying to drive.
  skipOnboarding(save);
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

/** The rail entry and the heading that proves its screen actually painted. */
const CORE_SCREENS: readonly { nav: string; heading: string }[] = [
  { nav: 'Tavern', heading: 'The Gilded Tankard' },
  { nav: 'Character', heading: 'Equipment' },
  { nav: 'Arena', heading: 'The Arena' },
  { nav: 'Quests', heading: 'The Quest Board' },
  { nav: 'Wishing Well', heading: 'The Wishing Well' },
];

async function gotoScreen(page: Page, screen: (typeof CORE_SCREENS)[number]) {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: screen.nav })
    .click();
  await expect(page.getByRole('heading', { name: screen.heading }).first()).toBeVisible();
}

/**
 * One line per offending node, because "3 violations" tells whoever broke it
 * nothing: the rule, how bad, the element, and the sentence axe would show.
 */
function report(violation: Violation): string[] {
  return violation.nodes.map(
    (node) =>
      `${violation.id} (${violation.impact}) → ${node.target.join(' ')} — ${violation.help}`,
  );
}

/**
 * §8's bar is "no serious violations", so moderate best-practice findings are
 * reported by the run above rather than gating it — the two live ones are the
 * missing `<h1>` inside the Shell and the Modal's `<header>` reading as a
 * second banner landmark.
 */
/**
 * Wait for every running animation to finish.
 *
 * Panels, cards and rewards animate in (B1), and several are staggered, so for
 * the first half-second after a navigation the screen is genuinely part-way
 * through a fade. axe samples computed colour, so auditing during that window
 * measures elements at partial opacity and reports a dozen contrast failures
 * that do not exist once the screen has settled. The audit's subject is the
 * settled UI, so wait for it.
 */
async function settle(page: Page) {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        // Infinite ones never finish by definition — the attention pulses run
        // forever. They are excluded from the wait AND from mattering: they
        // animate transform and brightness, never opacity, so there is no beat
        // at which they change what a contrast check would measure.
        .filter((a) => (a.effect?.getComputedTiming().iterations ?? 1) !== Infinity)
        .every((a) => a.playState !== 'running'),
    undefined,
    { timeout: 5000 },
  );
}

async function expectAccessible(page: Page, screen: string, allow: readonly string[] = []) {
  await settle(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const findings = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap(report)
    .filter((line) => !allow.some((known) => line.startsWith(known)));
  expect(findings, `axe on ${screen}`).toEqual([]);
}

test('axe: the core screens carry nothing serious or critical', async ({ page, isMobile }) => {
  test.skip(isMobile, 'walks the desktop rail; the mobile chrome has its own axe run below');

  await page.clock.setFixedTime(new Date(CLOCK));

  // — Before a hero exists: the slot cards, then the creation dialog —
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Import save' }).first()).toBeVisible();
  await expectAccessible(page, 'title');

  await page.getByRole('button', { name: 'New adventurer' }).first().click();
  await expect(page.getByRole('dialog', { name: "Sign the adventurer's ledger" })).toBeVisible();
  await expectAccessible(page, 'hero creation');
  await page.keyboard.press('Escape');

  // — And once one does —
  await importSave(page, craftSave());
  for (const screen of CORE_SCREENS) {
    await gotoScreen(page, screen);
    // No allow-list: --ink-faint was raised to #838f9f (tokens.css) so every
    // ink token now clears 4.5:1 on every surface, and the one waiver this
    // spec used to carry is gone rather than parked.
    await expectAccessible(page, screen.nav);
  }
});

/**
 * "Text scaling to 125% without clipping" (§8). The measurement is the page's
 * own scroll width: a layout that clips at larger type gives itself away by
 * pushing the document sideways.
 */
async function expectNoSideScroll(page: Page, screen: string) {
  const doc = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(doc.scroll, `${screen} at 125% text`).toBeLessThanOrEqual(doc.client);
}

test('125% text: no core screen grows a horizontal scrollbar', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(new Date(CLOCK));
  await importSave(page, craftSave());
  await page.addStyleTag({ content: 'html { font-size: 125%; }' });

  await expectNoSideScroll(page, 'tavern');
  // The rail is the only way to the other four, and it is desktop-only chrome.
  if (isMobile) return;
  for (const screen of CORE_SCREENS.slice(1)) {
    await gotoScreen(page, screen);
    await expectNoSideScroll(page, screen.nav);
  }
});

/**
 * The other half of "calm when the user enables reduced motion" (§7): the
 * animations that never asked the motion tokens for permission, which
 * `styles/a11y.css` sweeps up. Second Wind pulses while it is unclaimed, on
 * Tailwind's own 2 s keyframes — nothing a token can reach — so it is the
 * honest thing to point at, before and after.
 */
test('reduced motion reaches the animations that skipped the tokens', async ({ page }) => {
  await page.clock.setFixedTime(new Date(CLOCK));
  await importSave(page, craftSave());

  const pulsing = page.locator('.animate-pulse').first();
  await expect(pulsing).toHaveCSS('animation-duration', '2s');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(pulsing).toHaveCSS('animation-duration', '0.001s');
});

/**
 * "Visible gold focus ring" (§8), which axe cannot check either: it can see
 * that a control is reachable, not that the player can tell where they are.
 * Tabbing is the only honest way to ask, since `:focus-visible` is precisely
 * the rule that separates a keyboard arrival from a mouse click.
 *
 * Each ring is asserted with a retrying matcher rather than read once: the rail
 * transitions its colours and `outline-color` rides along, so a single sample
 * catches whatever shade the ring is passing through — the button's own
 * `--ink-muted` as often as not — and would fail on a busy machine while
 * passing on a quiet one. What §8 promises is that the ring *arrives*.
 */
test('the focus ring follows the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a ring for a hardware keyboard');

  await page.clock.setFixedTime(new Date(CLOCK));
  await importSave(page, craftSave());

  for (let step = 0; step < 12; step++) {
    await page.keyboard.press('Tab');
    const focused = page.locator('*:focus');
    if ((await focused.count()) === 0) continue;
    const name = (await focused.getAttribute('aria-label')) ?? (await focused.innerText()).trim();
    const ring = `focus ring on "${name}"`;
    await expect(focused, ring).toHaveCSS('outline-style', 'solid');
    await expect(focused, ring).toHaveCSS('outline-width', '2px');
    await expect(focused, ring).toHaveCSS('outline-color', 'rgb(240, 199, 94)'); // --gold-bright
  }
});

/**
 * The 44-px floor, measured where thumbs actually land (UI_DESIGN §4.4 ties it
 * to the mobile reflow; on the desktop rail a 176×38 row is a mouse target and
 * clears WCAG 2.2's 24-px minimum comfortably).
 */
test('the tavern is thumb-sized: every button clears 44×44', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the touch floor is a touch-layout promise');

  await page.clock.setFixedTime(new Date(CLOCK));
  await importSave(page, craftSave());

  const targets = await page.locator('button:visible').evaluateAll((els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      const name = el.getAttribute('aria-label') ?? (el.textContent ?? '').trim();
      return {
        name: name.slice(0, 40),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    }),
  );
  expect(targets.length).toBeGreaterThan(8); // the screen really did paint

  // No waiver. UI_DESIGN §8 says "hit areas >= 44 px" without carve-outs, and
  // the two HUD icon buttons that used to fail were widened to meet it rather
  // than named around — a gate with an allow-list on it is not a gate.
  const tooSmall = targets.filter((target) => target.width < TAP_MIN || target.height < TAP_MIN);
  expect(tooSmall).toEqual([]);
});

/**
 * The mobile chrome had never been audited at all.
 *
 * `MobileTabBar` and `NavSheet` exist only below the `lg` breakpoint, and the
 * desktop run above skips on mobile — so until this test the two surfaces a
 * phone player touches most were the two axe had never seen. The skip comment
 * used to claim "the mobile chrome is audited by the two specs below", but
 * those measure scroll width and tap targets; neither runs axe.
 */
test('axe: the mobile chrome, including the nav sheet', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'this IS the mobile run');

  await page.clock.setFixedTime(new Date(CLOCK));
  await page.goto('/');
  await importSave(page, craftSave());
  await expect(page.getByText('The Gilded Tankard')).toBeVisible();

  // The bottom tab bar, which replaces the rail entirely on a phone.
  await expectAccessible(page, 'tavern (mobile)');

  // …and the group sheet behind it, which nothing had ever opened under axe.
  // 'Town', not 'Adventure': group 0's headline entry IS the direct Tavern tab,
  // so Adventure has no sheet button at all (NavRail.tsx MobileTabBar).
  await page.getByRole('button', { name: 'Town', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Town' });
  await expect(sheet).toBeVisible();
  await expectAccessible(page, 'nav sheet (mobile)');

  // UI_DESIGN §8: "Esc closes overlays". NavSheet is the one real overlay in
  // the app that shipped without it — its only dismissal was a backdrop click,
  // which a keyboard user cannot perform.
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});
