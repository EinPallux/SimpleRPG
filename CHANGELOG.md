# Changelog

All notable changes to SimpleRPG. Format loosely follows [Keep a Changelog](https://keepachangelog.com);
versions follow [Semantic Versioning](https://semver.org).

Two things are worth knowing before reading any entry:

- **Saves migrate forward, never wipe** (CLAUDE.md invariant 9). Every schema change ships a migration and
  a frozen fixture test. If a release does not mention a schema version, none was needed.
- **The anti-rush contract is a product requirement, not a test detail** (BALANCING §8.2). Where a release
  moved a balance bound, it says so and points at the §10 changelog row that justifies it.

---

## [1.0.0] — 2026-07-29

First playable release. A fully single-player fantasy browser RPG that simulates an MMO with deterministic
bots: no backend, no accounts, no telemetry, no ads, and no real-money anything. All state lives in
IndexedDB on the device.

### The game

- **Four classes** — Warrior, Scout, Mage, Assassin — each with a distinct combat signature (block, evade,
  unblockable magic, twin strikes) rather than a stat spread.
- **Idle tavern missions** on timers, three offers at a time, spending vigor; **City Watch patrol** picks
  up when vigor is gone and trickles gold and XP for up to 8 hours, banking itself at midnight.
- **Ten zones** across a level 1–105+ frontier, **50 dungeon bosses** behind five wings of real walls,
  **expeditions** as the choice-driven premium spend, and the **Wheel of Destiny** as a daily gold sink
  that pays in items, gems and treats.
- **A living ladder**: 750 deterministic bots with names, guilds, classes and progression curves, climbing
  and churning on their own. The Arena, the Hall of Fame and the rank you hold are all against them.
  Nothing is persisted about the bot world except the world seed.
- **Collection** — 14 item sets with real full-set combat behaviours, **8 named legendaries** with bespoke
  effects, 16 pets with auras and a collection bonus, 4 mounts, 12 cosmetic frames.
- **The meta layer** — an 8-chapter story, daily/weekly/monthly quests, 70 achievements, 25 titles, an
  80-monster Codex that pays a permanent bonus, and a 28-day login calendar.
- **The Wishing Well**: a gacha with its odds and its pity counters printed on screen before you spend, an
  8-week deterministic banner rotation, and dupe protection that converts rather than evaporates.

### The promises this release keeps

- **No multiplayer, ever.** The bots look like players; everything is offline and deterministic.
- **The one premium currency is never sold for real money.** There is no purchase path and no hook left
  for one. Gems come from quests, achievements, the calendar, milestones and floors.
- **Anti-rush.** A patch is a season, not an evening. Enforced in CI by a balance simulator whose bounds
  are release-blocking: day one cannot exceed level 13, day 30 cannot exceed 62, the Pale King does not
  fall before day 140, and rank 1 lands between days 140 and 250 of optimal play.
- **~30–45 minutes of active play a day.** The game is not pure AFK, and does not want more than that.
- **Randomness is seeded and persisted** across seven named streams, so a reload cannot re-roll a drop.
- **Assets are CC0/CC-BY and credited** (ASSETS.md). No Shakes & Fidget or SimpleMMO art, names or text.

### Accessibility & platform

- Installable, offline-capable PWA that updates by prompt rather than behind your back.
- axe runs in Playwright over the core screens on desktop and mobile; 125% text scaling, 44 px hit areas,
  a 1–9 keyboard nav map, an Escape contract on every overlay, and a reduced-motion mode that reaches the
  animations the motion tokens cannot.
- Verified at **375 px**, the narrowest supported width, across all 16 screens.
- English-only content in an i18n-ready structure — every user-facing string goes through a key.

### Known and open

- **The hallway test with three people** (M8's acceptance bar) has not been run. Automation covers the
  mechanical half — a fresh hero walks the cold open to a claimed reward in `e2e/day1.spec.ts` — but not
  whether the first fifteen minutes actually land for a stranger.
- **SFX only, no music.** No CC0 audio was ever sourced, so the twelve cues are synthesised with Web
  Audio; ASSETS.md §4.1 sanctioned this fallback and Settings therefore has no music slider.
- Several screens title themselves through a panel rather than an `<h1>`; axe reports it as a moderate
  finding and it is logged rather than gated.

---

## Milestones

The build ran as ten vertical slices, each one playable. Full detail in ROADMAP.md.

| Milestone | What landed |
|---|---|
| **M0** Foundation | Vite + React 19 + TS strict, CI, Vercel preview, design tokens, Kenney frame system, save system (schema v1) |
| **M1** Engine core | `constants.ts` mirroring BALANCING, seven seeded RNG streams, combat, time/reset engine, and the **balance simulator as a CI contract** (schema v2) |
| **M2** Idle backbone | Live tavern offers with timers, claim and reroll; patrol; the daily loop (schema v3) |
| **M3** Hero & economy | Attribute buying as the infinite gold sink, gear, shops with persisted stock, potions, the Forge (schema v4) |
| **M4** Arena & ladder | 750-bot world generation, honor as a capped place-swap, arena fights with playback, Hall of Fame |
| **M5** Active pillars | 5 dungeons / 50 bosses, 14 sets with full-set combat behaviours, expeditions, the Wheel (schema v5) |
| **M6** Meta layer | Story, quests, 70 achievements, titles, Codex, calendar — all on an append-only **stat ledger** (schema v6) |
| **M7** Collection | Pets, mounts, the Wishing Well with visible pity; closed the last open row of the anti-rush contract |
| **M8** Onboarding & polish | Six-beat scripted first run with coach marks, 15 screen tours, 17 help pages, synthesised audio, PWA, the accessibility pass (schema v7) |
| **M9** Content-complete | The 8 named legendaries, flavor to its §13 volumes, the balance freeze, and the QA sweep |

### Bugs worth remembering

Each of these was found by measurement rather than by review, and each is pinned by a test now:

- **M7** — the simulator vendored the set pieces it was collecting, so `setsCompleted` was **0 for every
  profile on every run** and the entire full-set bonus layer was invisible to the balance model.
- **M7** — a treat faucet that rounded `1 × 1.18` back to `1`, making an 18% aura a no-op.
- **M8** — coach marks blocked the clicks they were pointing at, in three different ways.
- **M9** — a named legendary rolled at its gate level, so past L55 every one was *strictly worse* than the
  generated drop it replaced; a full backpack auto-sold a one-of-eight into pocket change unseen; and the
  simulator vendored those too, so the collection measured as permanently empty.
- **M9** — the Patrol screen cycled ten of its twenty flavor lines for three milestones. Nothing broke;
  players just never saw half the writing. Pool sizes are now declared once and asserted.

[1.0.0]: https://github.com/EinPallux/SimpleRPG/releases/tag/v1.0.0
