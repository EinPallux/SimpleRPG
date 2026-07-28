# ⚔️ SimpleRPG

**A fully single-player fantasy browser RPG** — the *Shakes & Fidget* experience (tavern missions, arena,
endless hero growth, a ladder worth climbing) with the best retention ideas of *SimpleMMO*, and **zero**
multiplayer: the living world is simulated by deterministic bots that look and behave like real players.
No servers, no accounts, no real-money anything. Runs entirely in your browser, deploys as static files
on Vercel, installs as a PWA.

> **Status: 🎮 Milestones M0–M6 built — the game has a memory.** On top of the idle loop, hero economy,
> simulated ladder and active pillars, there's now a reason to come back tomorrow: three rotating daily
> quests feeding an Activity meter and its chest, weeklies and month-long marathons, 70 achievements whose
> every tier is +3 to all attributes forever, 29 earnable titles, a 28-day innkeeper's calendar, an
> 80-monster Codex whose completed pages pay real gold-find and XP, and *The Ballad of Brambleford* — 40
> story steps across 8 chapters that gate by level and advance independently. It all runs off one
> append-only stat ledger, so nothing can desync and offline catch-up is free.
> Next: M7 — pets, mounts, and the Wishing Well.
>
> ```bash
> pnpm install && pnpm dev                     # play the current build
> pnpm test && pnpm e2e                        # verify (277 unit tests + clock-emulated e2e)
> pnpm sim -- --profile optimal --days 270     # watch every contract hold, gem ledger included
> ```

## The pitch

You're a freshly signed adventurer in the realm of **Aethermoor**. Take timed missions from the tavern,
patrol the walls when your vigor runs dry, duel "players" in the arena, bounce off dungeon bosses until
your numbers say otherwise, toss gems into a suspicious well, collect pets, sets, mounts and titles — and
climb a 750-name Hall of Fame that never noticed it isn't online.

- 🍺 **Idle backbone** — real-time missions, patrol-until-midnight, daily vigor economy
- ⚔️ **Active heart** — arena (10/day), 5 dungeons × 10 bosses, choice-driven expeditions, forge, shops, wheel
- 📈 **Endless growth** — no level cap, gold-bought attributes on an escalating curve (the infinite sink)
- 🏆 **A living fake MMO** — deterministic bot ladder with usernames, guild tags, streaks and rage-quits
- 🎰 **Ethical gacha** — one premium currency, earned only in-game, odds on screen, pity on the label
- 🐾 **The long tail** — 14 item sets, 16 pets, 4 mounts, 70 achievements, codex, titles, login calendar
- 🛡️ **Anti-rush by contract** — automated balance simulation enforces "a patch is a season, not an evening"

## Documentation map

| Doc | What's inside |
|---|---|
| [GAME_DESIGN.md](GAME_DESIGN.md) | Every system and rule — the design bible |
| [BALANCING.md](BALANCING.md) | Every formula, curve, economy audit, pacing contract |
| [CONTENT_CATALOG.md](CONTENT_CATALOG.md) | Zones, monsters, 50 dungeon bosses, sets, pets, quests, achievements |
| [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) | Stack, save system, time engine, RNG, bot world, testing |
| [UI_DESIGN.md](UI_DESIGN.md) | Design tokens, Kenney frame system, 24 screen specs |
| [ASSETS.md](ASSETS.md) | Asset inventory, art direction, licenses, sourcing plan |
| [ROADMAP.md](ROADMAP.md) | v1.0 build milestones M0–M9 + post-1.0 patch plan |
| [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) | Project invariants + contributor/agent workflow |

## Tech (planned)

Vite · React 19 · TypeScript (strict) · Zustand + Immer · Dexie (IndexedDB) · Tailwind 4 ·
framer-motion · howler.js · Vitest/Playwright · PWA · Vercel static hosting.

## Assets & credits

UI chrome from **Kenney's Fantasy UI Borders** (CC0), VFX from **Kenney's VFX Particles** (CC0), icons
planned from **game-icons.net** (CC BY 3.0), low-poly zone artwork supplied by the project owner.
Full policy and credits: [ASSETS.md](ASSETS.md). Reference screenshots in `game_assets/examples/` are for
internal vibe reference only and are never shipped.
