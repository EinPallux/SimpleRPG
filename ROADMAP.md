# SimpleRPG — Roadmap

> Canonical for scope, sequencing and release planning. v1.0 ships **complete** — no MVP, no skeleton:
> every feature in GAME_DESIGN.md, content volumes in CONTENT_CATALOG.md, bounds in BALANCING.md §8 green,
> quality gates in TECHNICAL_ARCHITECTURE.md §9 passing. Milestones are vertical slices that each end in a
> playable, deployed preview build. Check boxes off as milestones complete (CLAUDE.md workflow).

---

## Phase 0 — Planning ✅ (this commit)

- [x] Design suite: GAME_DESIGN · BALANCING · CONTENT_CATALOG · TECHNICAL_ARCHITECTURE · UI_DESIGN ·
      ASSETS · ROADMAP · CLAUDE · AGENTS · README

## Phase 1 — Build to v1.0

**M0 · Foundation** ✅ *(2026-07-28)* — Vite+React+TS scaffold, CI, Vercel preview, tokens + frame
system + fonts, asset pipeline (borders tinted, backgrounds optimized, icon sprite), app shell + nav
rail + HUD (static), save/load (Dexie, slots, export/import), clock module.
*Done when:* deployed preview shows themed shell on desktop+mobile; save roundtrip test green.
*Shipped:* 39 unit tests + e2e smoke green; typecheck/lint/build green; 126 KB gz initial JS.
Vercel config (`vercel.json`) is ready — connect the repo in the Vercel dashboard to get previews.

**M1 · Engine core + simulator** — constants.ts (all BALANCING values), rng streams, stats/xp/attr-cost,
items/loot generation, **combat engine + fixture tests**, time engine (resets, offline catch-up, tamper
guard), balance simulator CLI + first contract scenarios (`optimal-24h`, `optimal-7d`).
*Done when:* `pnpm sim --profile optimal --days 7` runs; §8.2 early bounds enforced in CI.

**M2 · The idle backbone** — Tavern missions (offers, timers, claim, reroll, lucky/story), vigor + Second
Wind + Golden Ale, zones 1–10 content, Patrol, daily reset live, RewardReveal, first 3 zone backgrounds in.
*Done when:* a fresh hero can play day-1 loop end-to-end on preview; `optimal-24h ≤ 13` green.

**M3 · Hero & economy** — Character screen (paper-doll, StatRows + attribute buying), Backpack, item
tooltips/compare, 3 shops + stock refresh, potions, Forge (upgrade/dismantle), sell flow.
*Done when:* full item lifecycle playable; economy audit table (§6) matches sim output ±10%.

**M4 · Arena & the living ladder** — bot world generation (names/guilds/archetypes), Hall of Fame,
arena offers/fights/honor/milestones, sparring, profile peek, combat playback polish.
*Done when:* ladder feels alive across 30 simulated days (`ladder-rank1` scenario green).

**M5 · Active pillars** — Dungeons 1–5 (50 bosses, walls, cooldowns, set drops), Expeditions (4 locales,
encounter cards, heroism chests), Wheel of Destiny.
*Done when:* `dungeon-walls` + `dungeon-final` scenarios green; a wall-bounce-return cycle plays well.

**M6 · Meta layer** — story chapters 1–8, daily/weekly/monthly quests + Activity chest, achievements (70)
+ titles, Codex, login calendar, unlock-ladder gating with locked-silhouette nav.
*Done when:* every unlock from L1→L95 triggers correctly in an accelerated sim playthrough.

**M7 · Pets, mounts, gacha** — Menagerie (16 pets, treats, collection bonus), Stable (4 mounts),
Wishing Well (3 banner types, pity, dupes→dust, free toss, odds UI).
*Done when:* `gem-strategies` scenario green; pity math property-tested.

**M8 · Onboarding & polish** — tutorial sequence + skip path, coach marks, help overlays, audio (SFX map,
volume settings), PWA, settings, error screen, a11y pass (axe + keyboard map), perf budget met.
*Done when:* a new player reaches the town map unaided in <15 min (hallway test with 3 people).

**M9 · Content-complete & balance freeze** — all [build-fill] flavor written (mission texts, boss intros,
codex lore, tips), icon set finalized, 180-day sim scenarios green, tuning changelog reconciled, QA sweep
(save migration fixtures, clock-jump tests, 375px layout), CHANGELOG + v1.0.0 tag.
*Done when:* **v1.0 on Vercel production.**

## Phase 2 — Post-1.0 patches (WoW-style content drops)

Cadence target: a patch every 6–10 weeks; each = content + one system; each extends the optimal-play
horizon by ≥ 6 weeks (sim-verified before release). Order intentionally: social illusion first (owner's
wish), then depth.

- **1.1 "Rivals & Records"** — arena seasons (quarterly soft-reset with cosmetic rewards), Deeds & Records
  board (S&F deeds), weekend event system (deterministic calendar: 2× XP Saturdays, gold rush Sundays,
  wheel weeks), 8 new achievements.
- **1.2 "Bands of Brothers"** — **AI guilds**: join one of 20 ladder guilds; guild hall, member roster with
  personalities, **simulated guild chat** (reactive scripted lines: greet your rank-ups, grumble about
  bosses), guild bosses (daily raid checkpoint), duo missions with an AI guildmate, guild shop currency.
  This is the "make bots feel 100% real" flagship.
- **1.3 "The Tower"** — 100-floor endless tower with companion system (3 AI party members with their own
  gear from your drops — the S&F Tower/companions fantasy), tower leaderboard vs bots.
- **1.4 "Homestead"** — fortress-like idle base: 8 buildings, offline resource production, raids by
  ladder rivals (simulated), new resource sinks. Zones 11–12, Dungeon 6, L120 sets, 4 pets, 2 mounts.
- **1.5 "The World Boss"** — weekly server-wide boss *simulation* (the whole ladder "participates",
  damage rankings, catapult-style upgrade minigame), seasonal events framework (4 holidays).
- **2.0 "New Worlds"** — prestige: retire a hero to found a new world (fresh ladder, legacy bonuses,
  scrapbook-style heirlooms), German localization, and the long-tail content engine.

## Release discipline

Every patch: sim bounds extended + green → content validation green → preview soak ≥ 3 days → tag +
patch notes in-game. Saves migrate forward always; never wipe. Hard exclusions stay hard (GAME_DESIGN §20).
