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

**M1 · Engine core + simulator** ✅ *(2026-07-28)* — constants.ts (all BALANCING values), rng streams,
stats/xp/attr-cost, items/loot generation, **combat engine + fixture tests**, time engine (resets,
offline catch-up, tamper guard), balance simulator CLI + first contract scenarios (`optimal-24h`,
`optimal-7d`).
*Done when:* `pnpm sim --profile optimal --days 7` runs; §8.2 early bounds enforced in CI.
*Shipped:* seeded rng streams (save-persisted), full combat with class signatures + §3.3 statistical
fixture, item/loot generator, mission/patrol/vigor reducers, save schema v2 + fixture-tested migration,
sim CLI (30 days in ~10 ms) with optimal/casual/idle profiles; CI enforces optimal-24h ≤13 · 7d ≤27 ·
30d ≤55 (day-30 optimal currently lands at L45 — headroom reserved for M4–M6 XP sources). MPL curve
re-anchored (BALANCING §10).

**M2 · The idle backbone** ✅ *(2026-07-28)* — Tavern missions (offers, timers, claim, reroll, lucky/story),
vigor + Second Wind + Golden Ale, zones 1–10 content, Patrol, daily reset live, RewardReveal, first 3 zone
backgrounds in.
*Done when:* a fresh hero can play day-1 loop end-to-end on preview; `optimal-24h ≤ 13` green.
*Shipped:* persistent tavern board (save schema v3, no offer-fishing; free daily reroll then 1 💎), lucky
offers ×2, live timers + claim + RewardReveal (xp/level-up/gold/item cards with procedural names), Second
Wind & Golden Ale, Patrol screen with 30-min shifts + accrual cap + tick log, in-session midnight rollover,
nav attention badges, 30 mission flavor texts (zones 1–3 + generic) and 10 patrol lines, full-backpack
drops auto-sell. E2E day-1 loop runs under Playwright clock emulation. *Deviation:* story-offer ribbons
ship with the quest system in M6 (they need story state to advance).

**M3 · Hero & economy** ✅ *(2026-07-28)* — Character screen (paper-doll, StatRows + attribute buying),
Backpack, item tooltips/compare, 3 shops + stock refresh, potions, Forge (upgrade/dismantle), sell flow.
*Done when:* full item lifecycle playable; economy audit table (§6) matches sim output ±10%.
*Shipped:* the infinite attribute sink live (+1/×10 with escalating costs), equip/unequip with class cuts
and swap, Backpack tab (sort, action modal with compare vs equipped), 3 shops with save-persisted daily
stock (schema v4) + free reroll then 1 💎, 15-elixir Arcanum rack (3 sockets, 24h, replace-same-attribute),
Forge upgrade bench (+20, scraps+gold) + dismantle bench (5/day pips), derived combat sheet from the real
combat builders. Sim now equips upgrades and the §6 audit is CI-asserted — which corrected the doc:
drop-vendoring measured at ~0.2% of income (accepted as design; loot's value is equipping + scraps,
BALANCING §10). E2E covers the full lifecycle via a deterministic imported save.

**M4 · Arena & the living ladder** ✅ *(2026-07-28)* — bot world generation (names/guilds/archetypes),
Hall of Fame, arena offers/fights/honor/milestones, sparring, profile peek, combat playback polish.
*Done when:* ladder feels alive across 30 simulated days (`ladder-rank1` scenario green).
*Shipped:* 750 deterministic bots derived from (worldSeed, dayIndex) — three name styles + guild tags,
archetype progression with weekend bumps/noise/rage-quits, nothing stored; arena with 3 ranked offers
(below/par/above), win-chance words from rehearsal sims, 10 rewarded bouts + 10-min cooldown (1 💎 skip),
sparring afterwards; honor as **capped place-swap** (BALANCING §4.5 — replaced ELO-lite gap-close after
270-day sims showed rank 1 falling by day ~90; summit is now power-gated) with first-time rank milestone
gems; CombatPlayback theater (HP bars, floating numbers, 1×/2×/skip, summary card) shared for M5 reuse;
Hall of Fame with windowed 751-row ladder, sticky standing bar, jump-to-me/top, class filter + search,
profile peek (derived gear snapshots, attrs, 14-day honor sparkline, fight-from-profile); sim arena
policies + CI ladder contract: top-100 days 80–115, rank 1 days 150–250, ladder moves ≥ 20 of 30 days.
*Deviation:* rank-milestone titles ship with the title system in M6 (gems pay out now).

**M5 · Active pillars** ✅ *(2026-07-28)* — Dungeons 1–5 (50 bosses, walls, cooldowns, set drops),
Expeditions (4 locales, encounter cards, heroism chests), Wheel of Destiny.
*Done when:* `dungeon-walls` + `dungeon-final` scenarios green; a wall-bounce-return cycle plays well.
*Shipped:* all 14 item sets live as data AND mechanics — 2/4-pc stat tiers plus every full-set combat
behavior in the engine (reflect, heal-on-block, counter-buff, after-evade crit, guaranteed first strike,
every-4th-strike, DR pierce, offhand 70%, poison crits, double-crit bonus, mission-item pp, expedition
perks), fixture-tested; 50 named bosses with intro threats + trait flags as §4 stat walls, hourly free
attempts, floors 5/10 drop dupe-protected set pieces (D2/D4 pity into class sets), per-floor gems and
one-time XP; expeditions as persisted 5-encounter card runs (fight/treasure/event/mini-boss, bold-or-safe
vignettes, heroism → Bronze/Silver/Gold chests, Twilight Wanderer widens the day); Wheel of Destiny with
honest odds table, rising spin costs, mystery re-rolls and a Legendary jackpot; three new screens + shared
playback, nav badges, schema v5 (+ migration fixture). Sim runs all of it: expedition/dungeon/wheel
policies, faucet audit refreshed to measured shares (§6), expedition payouts re-anchored to the 1.125×
target, BOT_DAILY_EQUIV +5% keeps rank 1 at day ~155–180, new CI contracts `dungeon-walls` +
`dungeon-final` + 90/180-day ceilings (§10 changelog ×2). *Deviations:* dungeons gate by level until story
keys land (M6); the jackpot's Gilded Snail fallback waits for pets (M7) — it pays Legendary gear until then.

**M6 · Meta layer** ✅ *(2026-07-28)* — story chapters 1–8, daily/weekly/monthly quests + Activity chest,
achievements (70) + titles, Codex, login calendar, unlock-ladder gating with locked-silhouette nav.
*Done when:* every unlock from L1→L95 triggers correctly in an accelerated sim playthrough.
*Shipped:* the **stat ledger** architecture (GAME_DESIGN §12.3) — `save.stats` is append-only and every
meta system is a pure read of it: quests measure a period delta against a reset snapshot, achievements and
story steps read lifetime values, and one `engine/metrics.ts` switch resolves the derived metrics. No event
bus, nothing to desync, offline catch-up free. Content: 40 story steps across 8 independently-gated
chapters (128 strings of prose), 42 quests, 70 achievements in 7 categories (146 tiers, +3 all-attrs each),
29 titles, 80 bestiary monsters with lore, 28 calendar slots + 12 monthly frames — authored by five
parallel agents against a shared `content/meta.ts` contract, each with its own validation suite. Bestiary
pages now fill from play: expedition fight cards draw **named** zone monsters and missions record
sightings. Four screens (Quest Board with Activity meter + free daily swap, Achievements, Codex with
completion bonuses that feed gold-find/XP, Calendar), a story banner with guided deep-links, and a title
picker. Schema v6 + migration. *Balance:* the gem ledger caught a 106.9/wk faucet against §6's ~30/wk line
and was re-anchored to 44.6/wk blended; the early §8.2 ceilings moved (7d 27→35, 30d 55→62) with a written
rationale — **the long-horizon ceilings did not move and still pass** (day-90 85 ≤ 90, day-180 110 ≤ 118).
`casual-30d` and `zone-frontier` came off the todo list; only `gem-strategies` remained, waiting on M7's
Wishing Well to give gems a competitor (it landed — see below). *Deviations:* the Armory codex page is a completion meter rather than a
per-design gallery. (Chapter 5's dependency on pets cleared in M7 — a 270-day run now banks 34 of 40
steps, limited only by how far it levels.)

**M7 · Pets, mounts, gacha** ✅ — the collection layer, and the last open row of the anti-rush contract.
**16 pets** across four families, each with a major and a minor aura that grows to 3× by level 50 on Pet
Treats, arriving from five different systems (story chapter 5, six zone drop chains, two dungeon
first-clears, two achievements, the well's two exclusives, and the wheel's jackpot-only Gilded Snail);
every distinct pet owned is +0.5% to all attributes, capped at +8%. Auras fold into the *existing* derived
stat pipeline — inside the same caps as gear — so nothing else in the game needed a special case. **4
mounts** on a lopsided ladder (5k → 75k → 1.2M gold, then the Ember Drake at 60 gems), each carrying a
cosmetic title; mount speed and the pet `missionSpeed` aura stack multiplicatively, never additively.
**The Wishing Well**: three banners on a deterministic 8-week rotation (14 after L85), pity at 10 and 30
persisted per banner, dupes that convert rather than evaporate, a free daily toss, and an odds table plus
pity counters that are on screen unconditionally. 12 cosmetic frames. No schema change — v6 already carried
every field. *Balance:* the simulator grew three gem-strategy profiles and immediately found something more
interesting than a tuning bug — `setsCompleted` was **0 in every run ever measured**, because the sim
vendored the set pieces it was collecting, hiding the whole full-set bonus layer from the balance model.
Fixing that (plus wearing the set once owned) was worth more than any constant. The `gem-strategies` row
was then **re-stated from measurement**: drake-first and ale-max land 2.2% apart, and all-in gacha trades
~14% of attribute power for the collection — a playstyle, not a trap (BALANCING §10).
*Done when:* ✅ `gem-strategies` green — **every §8.2 contract row now has a scenario**; pity asserted per
banner over hundreds of tosses.

**M8 · Onboarding & polish** ✅ — the game stops assuming you already know it. The scripted first fifteen
minutes (§17) runs as six data-driven beats from the cold open to the town reveal, pointed out by anchored
**coach marks** that spotlight without caging — no backdrop that eats clicks, no focus trap, and a skip door
on every step that grants nothing because the tutorial withholds nothing. Fifteen screens carry a
**15-second first-visit tour**, and all seventeen keep a permanent **"?"** with a hand-written page behind it
(105 strings, every number read off the real constants rather than the prose). **Sound** arrived as twelve
synthesised Web Audio cues wired to outcomes, with master/SFX sliders, mute, a reduced-motion override,
instant-combat and timer-format toggles. The game is now an **installable, offline-capable PWA** that
updates by prompt rather than behind your back, split four ways so no chunk approaches the 500 kB line.
**Accessibility** is enforced rather than asserted: axe runs in Playwright over the core screens, a 1–9 nav
map and Escape contract are wired, and 125% text scaling and 44 px hit areas are asserted — the two HUD
buttons that failed were widened rather than allow-listed. Schema v7 + migration (an existing save arrives
already onboarded, but with its tours unseen).
*Deviations, both documented:* **no audio files exist** — the planned Kenney CC0 sprite was never sourced,
so the cues are synthesised (ASSETS.md §4.1), and v1.0 ships SFX-only per that doc's own fallback, which is
why Settings has no music slider. **framer-motion** was never needed; CSS keyframes and the motion tokens
cover every §7 moment.
*Done when:* the stated bar was a hallway test with three people, which I cannot run. The substitute is
mechanical and honest: `e2e/day1.spec.ts` walks a genuinely fresh hero from "New adventurer" through the
cold open to a claimed reward, and the sequence is six beats long with a one-click escape at every one. A
real hallway test remains **open for the owner** before v1.0 — it is the one M8 acceptance criterion that
automation cannot stand in for.

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
