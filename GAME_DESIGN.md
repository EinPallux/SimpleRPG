# SimpleRPG — Game Design Document (v1.0)

> **Canonical scope:** This document defines every game system, its rules, and its design intent.
> Exact formulas, curves and tuning bounds live in **BALANCING.md** (if numbers conflict, BALANCING.md wins).
> Full content enumerations (zones, monsters, sets, pets, quests, achievements…) live in **CONTENT_CATALOG.md**.
> Screens and components live in **UI_DESIGN.md**. Implementation in **TECHNICAL_ARCHITECTURE.md**.

---

## 1. Vision

**SimpleRPG** is a fully **single-player** fantasy browser RPG in the spirit of *Shakes & Fidget*, with the
best retention ideas of *SimpleMMO* folded in — minus every multiplayer feature. It simulates the *feeling*
of a living MMO world (arena opponents, a ladder full of "players", guild tags, a bustling town) entirely
offline, with deterministic bots.

| Pillar | What it means in practice |
|---|---|
| **An MMO that isn't** | Bot ladder, bot arena opponents, fake-but-believable usernames and guild tags. The world feels populated; nothing is online. |
| **Idle backbone, active heart** | Timed missions and patrol carry progress while away; arena, dungeons, expeditions, forge and shops give ~30–45 min of real decisions per day. Never "3 buttons then AFK". |
| **Numbers that never end** | No level cap. Attributes purchasable with gold forever (escalating costs). Post-1.0 patches extend the frontier like WoW patches. |
| **Respectful monetization = none** | One premium currency (**Gems**) that is *earned, never bought*. Scarcity is a design tool, not a paywall. |
| **A patch is a season, not an evening** | Hard daily gates (energy, arena fights, shop stock, dungeon cooldowns) + superlinear curves mean v1.0 content lasts 6+ months of optimal play. Enforced by automated balance simulation (see BALANCING.md §9). |
| **Warm, funny, light** | Tone is lighthearted fantasy with dry humor (original flavor — no borrowed IP). Losing a fight should make you grin, not rage. |

**Fiction in one line:** You are a freshly signed adventurer in the realm of **Aethermoor**, operating out of
the town of **Brambleford**, taking odd jobs from the tavern **The Gilded Tankard**, and clawing your way up
the realm's famous Hall of Fame.

**Platform:** Browser (desktop-first, fully responsive, installable PWA). Deployed on Vercel. 100% client-side.

**Player promise:** 2–5 sessions per day, 5–20 minutes each. There is *always* something worth logging in for,
and *never* a punishing amount of it.

---

## 2. The Core Loop

```
            ┌────────────────────────────────────────────────┐
            │                  DAILY RESET                   │
            │   (local midnight: vigor, shops, arena, wheel) │
            └───────────────┬────────────────────────────────┘
                            ▼
  Spend VIGOR ──► Missions (timed, idle) ──► Gold / XP / Items
       │              Expeditions (active)──► better yield, choices
       │
       ├─► Vigor empty ──► PATROL until midnight (passive trickle)
       │
  Spend COOLDOWNS ─► Arena (10/day) ─► Honor → Ladder rank → Gem milestones
       │             Dungeons (1/h each) ─► Set pieces, walls to push
       │             Wheel (5/day), Shops (daily stock), Forge (5 dismantles)
       │
  Spend GOLD ─► Attributes (infinite sink) · Shop gear · Potions · Mounts · Upgrades
  Spend GEMS ─► Wishing Well (gacha) · Golden Ale · Ember Drake · small skips
       │
       ▼
  POWER UP ──► push next dungeon floor / zone / arena bracket ──► repeat tomorrow
```

Long-term chases running in parallel (the "always another goal" braid):
levels → zones → dungeon floors → class sets → ladder rank → pets → mounts →
achievements/titles → codex completion → gacha banners → login calendar.

---

## 3. The Hero

### 3.1 Character creation
- Choose **name** (2–16 chars), **class** (one of four), **portrait** (procedural emblem: icon × palette ×
  frame — 48 combinations at launch), optional **title** later via achievements.
- One save slot holds one hero; **3 save slots** allow alt classes (each slot has its own bot world seed).

### 3.2 Attributes (5)
| Attribute | Effect |
|---|---|
| **Strength** | Main attribute for Warrior. Off-class: reduces damage from Strength-based enemies. |
| **Dexterity** | Main attribute for Scout & Assassin. Off-class: reduces damage from Dexterity-based enemies. |
| **Intelligence** | Main attribute for Mage. Off-class: reduces damage from Intelligence-based enemies. |
| **Constitution** | Hit points: `CON × classHpFactor × (level + 1)`. |
| **Luck** | Critical hit chance (cap 50%, Assassin 60%). Crits deal 200% (Scout 250%). |

- Main attribute drives damage: `weaponDamage × (1 + effectiveMain / 10)`.
- Defender's matching attribute halves its value against you (S&F-style soft defense) — see BALANCING.md §3.
- **Attribute points are bought with gold only** (no free points per level). Cost escalates per point bought,
  capped at 10,000,000 gold per point → gold stays valuable forever. Gear and achievements add attribute
  bonuses on top.

### 3.3 Classes (v1.0 = 4, all mechanically unique)

| | **Warrior** | **Scout** | **Mage** | **Assassin** |
|---|---|---|---|---|
| Fantasy | Unbreakable front-liner | Precise skirmisher | Glass artillery | Twin-blade gambler |
| Main attr | Strength | Dexterity | Intelligence | Dexterity |
| HP factor | 5.0 | 4.0 | 2.0 | 3.5 |
| Signature | **Shield Block 25%** (blocks a hit entirely) | **Evade 35%** + crits deal **250%** | Attacks **cannot be blocked/evaded**; weapon damage ×1.9 | **Two strikes/round** (main + offhand at 65% each); Evade 15%; crit cap **60%** |
| Offhand slot | Shield (+armor, +5 pp block) | Quiver (+10% damage) | Tome (+8% damage, +INT) | Second weapon (fuels 2nd strike) |
| Armor weight | Heavy (×1.5) | Medium (×1.0) | Cloth (×0.6) | Light (×0.85) |
| Counterplay | Block never triggers vs Mage | Evade never triggers vs Mage | Lowest HP pool in the game | Evade never triggers vs Mage |

Class identity is expressed through: combat signature, armor weight, class-specific item sets (3 per class),
offhand type, and starting attribute spread (CONTENT_CATALOG.md §2).

### 3.4 Leveling
- **No level cap.** XP needed per level grows superlinearly (BALANCING.md §2).
- Levels gate content (zones, dungeons, systems — see §14 Unlock Ladder) and scale HP.
- XP sources: missions, expeditions, arena, dungeons, quests, patrol (small), wheel, achievements.

---

## 4. Energy — "Vigor" (the idle backbone)

- **Vigor** is the daily adventure energy. Base **100 per day**, restored at daily reset (local midnight).
- **Second Wind**: once per day, a free claimable **+50** (a button in the tavern — the innkeeper's on-the-house round).
- **Golden Ale**: up to **5 per day**, **+20 vigor each, 2 Gems each** — the optimizer's gem sink.
- Daily maximum: **250 vigor**. Unspent vigor is lost at reset (log-in incentive), except tutorial day 1.
- Missions cost vigor equal to their duration in minutes (5/10/15/20). Expeditions cost 25.

Design intent: vigor bounds the **daily XP/gold ceiling** regardless of playtime → a no-lifer cannot rush a
patch; a lunch-break player loses nothing they couldn't spend. Mounts compress *real time*, never the cap.

---

## 5. The Tavern (missions — idle pillar)

At **The Gilded Tankard**, three patrons offer missions; pick one, the other two wait.

- Each offer: destination **zone** (background art), **flavor text** (funny one-liner), **size**
  (5/10/15/20 — this is the **vigor cost** and the reward scale), rewards preview: gold, XP,
  **33% item chance**, **5% bonus chest**.
- **Size is not the same as the clock.** Past level 10 a size-N mission takes N minutes; at levels 1–10 the
  clock is compressed to **30–90 seconds**, and the very first errand of a save is always **30 seconds**, so
  a new player sees the whole accept → wait → claim → reward loop several times in their first sitting. The
  vigor cost and the payout are untouched by this — vigor meters the day, so a faster clock buys pace and
  never power (BALANCING §2.2, §10).
- Missions run in real time (continue while the tab is closed). On completion the reward sits banked until
  claimed. Claiming may trigger: item drop reveal, story-quest progress, rare events.
- **Every mission ends in a fight** with a resident of the zone you were sent to — a real bout at your own
  level, played back like an Arena bout. The mission's **gold and XP are paid regardless of the outcome**:
  you did the job, and this game does not punish. Winning adds a bonus on top (BALANCING §1), losing costs
  nothing but the bonus. You met the creature either way, so the Codex records it either way.
- **Reroll** all three offers: 1× per day free, further rerolls 1 Gem.
- **Special offers** (rolled into the pool): **Lucky Mission** (~5%, double loot, sparkle border),
  **Story Mission** (⚑ marker, advances the active story chapter — see §12).
- **Skip timer**: 1 Gem per started 5 remaining minutes (cap 3) — convenience valve, intentionally poor value.
- **Zone choice matters**: missions roll from the highest unlocked zone by default; the frontier zone yields
  full value, older zones −8% per step (floor 60%) but with that zone's drop table (pets! codex entries!).
  Player can pin a preferred zone.
- **Onboarding pacing (hybrid)**: during the scripted tutorial (roughly the first 30–60 minutes) missions run
  1–3 minutes; from town unlock onward, authentic 5–20 min pacing applies (BALANCING.md §8).

**Mounts** (§11) reduce mission duration up to −50%, letting a played day fit more missions into fewer hours —
but never exceed the vigor cap.

---

## 6. Patrol — the after-hours trickle

When vigor is (almost) spent, the town still needs boots on the wall.

- Unlocks at **level 3**. Startable **only while Vigor < 5** — flavor: *"The Watch only hires exhausted
  adventurers. Union rules."*
- While patrolling: accrues **gold ≈ 30% of frontier-zone mission rate** and **10% of mission XP rate**,
  ticking every **30 minutes** (partial ticks discarded).
- Accrual cap: **8 hours** uncollected (collect to restart the meter — a reason to check in).
- Patrol **auto-stops and banks** at midnight reset (never spans two days).
- Mutually exclusive with missions/expeditions. Cancel any time, keeping completed ticks.
- Small event text every tick ("You confiscated a suspiciously juggling goblin's third torch.") — patrol
  screen uses the dedicated city-wall artwork (`patrol_background.png`).

Design intent: fulfils the S&F "City Guard" fantasy; guarantees *something* accrues until the midnight reset
without competing with the vigor economy.

---

## 7. Combat (auto-battler with playback)

All combat is **automatic** (S&F-style): the outcome is computed instantly by a pure, seeded function; the UI
plays it back as an animated exchange (skippable, "instant result" toggle in settings).

- Turn-based rounds; both combatants strike once per round (Assassin twice); first striker per fight is a
  50/50 roll; strikes then alternate.
- Per strike: evade check → block check → damage roll `weapon × (1 + effMain/10) × rage × (1 − DR)` → crit check.
- **Rage**: ×(1 + 0.05·(round−1)) global damage ramp so every fight ends (~cap 100 rounds; tie → attacker loses).
- Class signatures per §3.3; block/evade never trigger against Mage attacks.
- Full formulas + worked examples: BALANCING.md §3.
- **Combat playback**: side-by-side portraits, HP bars, floating damage numbers, block/evade/crit callouts,
  particle effects (Kenney VFX pack), 3–8 seconds, skippable. Every fight shows a shareable-feeling summary
  (damage dealt, biggest crit, rounds).

Used by: Arena, Dungeons, Expedition fights, story bosses, (post-1.0: guild content, world boss).

---

## 8. Arena & Hall of Fame (simulated PvP + ladder)

### 8.1 Arena (unlock level 5)
- **10 rewarded fights per day**; **10-minute cooldown** between fights (skip: 1 Gem).
- Choose **1 of 3 opponents** drawn from the ladder near your rank: one slightly below you, one at par, one
  above (better honor/gold on the riskier pick). Opponents are **bots that look exactly like players**:
  username, guild tag, class, level, emblem portrait, inspectable gear and attributes.
- Win: **Honor** (capped place-swap transfer, BALANCING.md §4.5), gold, 20% chance of an Arena Chest
  (gear at your item level). 
  Lose: small honor loss, consolation gold, *funny defeat line*.
- After the 10 rewarded fights: unlimited **Sparring** (no rewards, no honor loss) — practice and fun remain
  unbounded, the economy stays capped.
- **First-time rank milestones** award Gems + Titles: reach rank 500 / 250 / 100 / 50 / 25 / 10 / 3 / 1
  (CONTENT_CATALOG.md §8).

### 8.2 Hall of Fame (full view unlocks level 15; arena shows your rank from level 5)
- The realm ladder: **750 named bots + you**, ranked by Honor. Columns: rank, emblem, name, guild tag, class,
  level, honor. Your row is highlighted and pinned controls jump to top/you.
- Any row is inspectable: profile with gear, attributes, honor history sparkline — bots feel like people
  (deterministic gear snapshots, see §8.3).
- Ladder is **alive**: bots gain levels/honor daily, streak, slump, go on vacation, rage-quit (~2%/month,
  replaced by fresh level-1 names at the bottom), and cluster into visible "guilds" (cosmetic tags in v1.0;
  real AI guilds arrive post-1.0 — ROADMAP.md).

### 8.3 The Bot World (the illusion engine)
- Generated once per save from the **world seed**: 750 bots with procedural usernames in three styles
  (fantasy names, gamer tags with numbers/underscores/leet, roleplay handles), 20 guild tags, class spread,
  emblem portraits, and an **archetype**: No-lifer 4% · Dedicated 21% · Regular 45% · Casual 22% · Dormant 8%.
- Each bot's level/honor on any calendar day is **derived deterministically** (seed + day index) from its
  archetype curve with weekly rhythm (weekend bumps), noise streaks, and life events — nothing is stored,
  everything recomputable (TECHNICAL_ARCHITECTURE.md §7).
- The world starts "3 weeks old" (bots level 1 to the high 40s) so day-1 players land near the bottom but
  see a reachable mid-field. Catch-up targets (numbers canonical in BALANCING.md §8.2, enforced by the
  `ladder-rank1` simulation): overtake casuals in weeks, regulars in ~2–3 months, top-100 ≈ days 80–115,
  top-10 ≈ month 4–5, **rank 1 within days 150–250** of optimal play.
- Bots' displayed gear/attributes are derived per (botId, level band) — inspecting twice shows the same kit.

---

## 9. Items & Equipment

### 9.1 Slots (10)
Weapon · Offhand (class-specific) · Helmet · Chest · Gloves · Boots · Belt · Amulet · Ring · Talisman.

### 9.2 Rarity ladder
| Rarity | Bonus lines | Extras | Color |
|---|---|---|---|
| Common | 0 | — | gray |
| Uncommon | 1 | — | green |
| Rare | 2 | — | blue |
| Epic | 3 | +10% base stats; may roll % lines | purple |
| **Set** | 3 | Set bonuses at 2/4/full pieces | teal-green |
| Legendary | 3 | +20% base stats + **unique named effect** (8 uniques at v1.0) | orange |

- Item power comes from **item level** (drops ≈ player level ±2) driving base weapon damage/armor, plus bonus
  attribute lines (BALANCING.md §5). % lines (crit damage, gold find, XP) only on Epic+ with global caps.
- **Rarity is also encoded non-chromatically** (corner pips 0–5) for colorblind accessibility.

### 9.3 Item lifecycle (every drop has five exits)
**Equip** · **Sell** (20% value, instant gold) · **Dismantle** (Forge → Scraps/Dust, 5/day) ·
**Upgrade** (Forge, +1…+20) · **Keep** (backpack 30 slots, +5 more earned via achievements).
Every *new* item design seen is logged in the **Codex** forever (§13) — even vendored dupes count once.

### 9.4 Item sets (the chase)
- **14 sets at v1.0**: 3 per class (early ~L20 · mid ~L60 · endgame ~L100) + 2 class-agnostic
  ("Innkeeper's Regalia" L40 — gold/XP fun set; "Twilight Wanderer" L85 — hybrid).
- Bonuses at **2 / 4 / full** pieces (4-piece sets: 2 / 4). Full bonuses are build-defining (e.g. Warrior
  L100: blocked hits reflect 30%; full list CONTENT_CATALOG.md §5).
- **Sources — grind AND luck, never shops**: dungeon floors 5 & 10 (deterministic pools + dupe-protection),
  Wishing Well banners (§10), monthly quest **Set Token** (choose any piece you're missing — pity anchor).

### 9.5 Shops (daily merchant loop)
| Shop | Unlock | Sells |
|---|---|---|
| **Weapon Smith** | L10 | Weapons & offhands (all classes) |
| **Armorer** | L10 | Helmet/chest/gloves/boots/belt |
| **The Arcanum** | L12 | Amulets/rings/talismans + **potions** |

- Each shop: **6 items**, stock **refreshes at midnight**; 1 free manual reroll per shop per day, further
  rerolls 1 Gem. Stock rarity up to Epic (never Set/Legendary). Prices in gold — a real early/mid sink.
- The Arcanum also sells **Elixirs** (3 tiers: +10/15/25% to one attribute for 24h real-time; 3 active potion
  slots, no duplicate attribute) — a permanent daily gold sink for optimizers.

### 9.6 The Forge (unlock L15)
- **Upgrade** any equipment +1…+20: costs Scraps + gold (escalating); each level +2.5% base stats;
  +5/+10/+15/+20 add visual glow tiers. Upgrades transfer 70% of invested scraps when dismantled.
- **Dismantle** (5/day): item → Scraps (1/2/4/8/15 by rarity) + Arcane Dust (Epic+).
- **Reforge** (unlock L60): reroll one bonus line — costs Arcane Dust + gold. Dust comes from dismantling
  Epic+, gacha dupes, and deep dungeon floors.

---

## 10. The Wishing Well (gacha — unlock L18)

An old well behind the tavern. Toss gems in; the well tosses *stuff* back. **No real money. Odds on-screen.**

- **Cost**: 5 Gems per toss · 45 per 10-toss (10th toss discounted, classic ritual).
- **Free daily toss** on the Standard pool (teaches the system, daily ritual).
- **Banners** (rotate deterministically from the calendar — no server needed):
  - **Standard Well** (always): full pool — consumables, gear, set pieces, pets, cosmetic frames.
  - **Featured Banner** (rotates **weekly**, Mon): one class set on rate-up (75% of set-piece hits are the
    featured set) + its exclusive cosmetic portrait frame. 8-week schedule in CONTENT_CATALOG.md §7.
  - **Pet Banner** (rotates **biweekly**): pet-egg focused pool incl. 2 Well-exclusive pets.
- **Pity (per banner type, persisted)**: every 10 tosses guarantees Epic+; **hard pity 30** guarantees a Set
  piece (on Featured: guaranteed *featured* set). Counters visible in UI (ethical gacha) — the odds table
  and both counters render unconditionally on the Well screen, never behind a tooltip or a second tap.
- **Dupes** auto-convert: Set/Legendary dupes → Arcane Dust + Codex credit; pet dupes → Pet Treats.
- Full odds table: BALANCING.md §7; pool contents: CONTENT_CATALOG.md §7.

Design intent: gacha is the **luck path** to the same sets the dungeons grind out — two roads, one chase;
gems stay precious (~30/week steady-state income, BALANCING.md §6).

**What the well is worth, honestly** (measured M7, BALANCING §8.2/§10): pouring every gem into the well
costs roughly **14% of end-state attribute power** at day 120 against pouring them into Golden Ale, and
buys the collection instead — more pets, more frames, sets completed. That is the trade the well is *for*,
and the game should never pretend otherwise. What the contract does forbid is the Ember Drake being a
mistake: 60 gems of mount lands within 12% of 30 ales, so the Stable's headline purchase is always
defensible.

---

## 11. Pets & Mounts

### 11.1 Pets — the Menagerie (unlock L35 via story chapter 5)
- **16 pets at v1.0** across 4 families (Beast/Elemental/Spirit/Cryptid), each with a passive aura
  (one major + one minor bonus, e.g. "+X% gold find, +small CON").
- **One pet equipped at a time** (aura active); switching is free.
- Pets level **1–50** with **Pet Treats** (missions, patrol ticks, quests, wheel) scaling their aura.
- **Collection bonus**: each distinct pet owned grants **+0.5% all attributes** (max +8%) — collecting matters
  beyond the equipped one.
- Sources: story (3), zone mission drop chains (6, e.g. Ember Fox ~2% from Cinderpeak missions), dungeon
  first-clears (2), achievements (2), Wishing Well pet banner (2 exclusives), wheel jackpot (1).
  Full list: CONTENT_CATALOG.md §6.

### 11.2 Mounts — the Stable (unlock L1, rented by the fortnight)
| Mount | Effect | Rent (14 days) |
|---|---|---|
| Barley the Pack Mule | −10% mission duration | 5,000 gold |
| Dappled Courser | −20% | 75,000 gold |
| Bastion Warhorse | −30% | 1,200,000 gold |
| **Ember Drake** | **−50%** | **60 Gems** (the big day-one gem decision vs. ale and the Well) |

- **Rented, not owned** (the S&F model). Every purchase buys 14 days at full price — there is no trade-in
  and no upgrade discount. When the term is up the animal goes back to Wilbur and you walk until you pay
  again. Renewing the same mount early *extends* the term; switching animals starts a clean one.
- **The Stable opens at level 1**, and a new hero starts with exactly the Drake's rent in their purse
  (`STARTING_GEMS`). That is deliberately the *choice* and not the mount: the same 60 gems buy 30 ales or
  twelve tosses at the Well, and finding out which you'd rather have is the point.
- A mount buys **real-world time, never power** — vigor meters the day, so halving mission duration lets a
  played day fit into fewer hours; it never earns more. The balance contract measures both sides of that
  trade (BALANCING §8.2 `gem-strategies`).
- Mounts each add a tiny cosmetic title ("…the Well-Saddled"), and titles are **kept when a rental lapses**.

---

## 12. Quests

### 12.1 Story questline — "The Ballad of Brambleford" (doubles as deep onboarding)
- **8 chapters × 5 steps = 40 steps** at v1.0, from "sign the adventurer's ledger" (~L1) to confronting the
  Pale King (~L100+). Steps are things you'd do anyway, aimed: *complete a mission in X*, *reach dungeon floor*,
  *win 3 arena fights*, plus scripted story missions with unique flavor.
- Rewards: gear, gems (first-time), **system unlocks** (dungeons' keys, Menagerie, Expeditions), titles.
- Chapter outline: CONTENT_CATALOG.md §9.

### 12.2 Daily / Weekly / Monthly quests (unlock L6)
| Cadence | Count | Examples | Headline rewards |
|---|---|---|---|
| **Daily** | 3 (from pool of 24) | spend 80 vigor · win 3 arena fights · dismantle 2 items · finish an expedition | gold, scraps, treats + **Activity points** |
| **Weekly** | 3 (pool of 12) | clear 2 dungeon floors · complete 2 expeditions · buy 3 attribute points ×20 | **3 Gems each** + materials |
| **Monthly** | 2 (pool of 6, marathon) | win 120 arena fights · complete 60 missions | **15–20 Gems** + **Set Token** + cosmetic |

- **Activity meter**: daily quests + core actions fill 0–100; at 100 the **Daily Chest** opens (gold +
  scraps + 40% chance of 1 Gem). Resets daily. This is the "did my dailies" heartbeat.
- Quests reroll at their cadence; one daily may be swapped free per day (avoid feel-bads).

### 12.3 How the meta layer measures anything (the stat ledger)

Implementation contract for §12–13, decided in M6: **`save.stats` is an append-only ledger** of everything
the hero has ever done, and every meta system is a pure *read* of it.

- **Quests** measure a **period delta**: `metric(now) − statsAt[metric]`, where `statsAt` is a snapshot of
  the ledger taken when the period reset. Nothing writes quest progress, so offline catch-up is free and a
  mid-quest reload cannot desync. Quest metrics must therefore be monotonic counters.
- **Achievements and story steps** measure **lifetime** values from the same ledger.
- Metrics that aren't raw counters (level, sets completed, codex %) resolve through one switch in
  `engine/metrics.ts`; content refers to them by id, so adding a metric never touches content.
- Consequence worth knowing: a quest whose metric is *exhaustible* (dungeon floors — there are only 50)
  goes dead once mined out, and two metrics are class-gated (`blocks` is Warrior-only, `evades` is
  Scout/Assassin) — the free daily swap is the release valve for both.

**Chapters gate by level and advance independently** (changed from a single linear pointer in M6): steps
inside a chapter are linear, but a level-45 hero can work chapter 6 while chapter 5 waits on a system that
hasn't unlocked yet. Without this, one gated beat would stall the entire questline.

---

## 13. Achievements, Titles & Codex (the long tail)

- **Achievements**: **70 at v1.0** in 7 categories, most tiered bronze/silver/gold. Rewards: permanent
  **+3 all attributes per tier** (stacking — the S&F library idea), Gems on gold tiers, **Titles** on
  signature feats. Full list: CONTENT_CATALOG.md §10.
- **Titles** (~25): equip one; shows on your profile and your row in the Hall of Fame
  ("Grimble **the Patient**"). Pure prestige.
- **Codex** (unlock L25): collection log with permanent bonuses (all page-completion bonuses global-capped —
  BALANCING.md §6): 
  - **Bestiary** — every monster: kill counter, lore blurb at 10 kills; per-zone completion → +1% gold find.
    Pages fill from where you actually go: expedition fight cards draw a **named monster** of the matching
    archetype from your frontier zone, and every claimed mission records a sighting (M6 decision).
  - **Armory** — every item design discovered; per-tier completion → +XP%.
  - **Menagerie / Stable / Vault** — pets, mounts, cosmetic frames.
  - Overall completion % on the cover — the 100% chase for finishers.

---

## 14. Calendar, Resets & the Daily Ritual

- **Login Calendar**: 28-slot monthly board; each day you log in, claim the next slot (no harsh reset on a
  missed day — the board just waits). Slots 7/14/21 pay Gems (3/5/7); slot 28: exclusive cosmetic frame
  + 10 Gems. Month themes recolor the board.
- **Resets** (all local time, with anti-clock-tamper guards — TECHNICAL_ARCHITECTURE.md §6):
  - **Daily (midnight)**: vigor → 100, Second Wind reset, shop stock, arena fights 10, wheel spins 5,
    dismantles 5, dailies, activity meter, patrol banks & stops, free gacha toss, ale counter.
  - **Weekly (Monday)**: weekly quests, Featured Banner rotation.
  - **Monthly (1st)**: monthly quests, calendar board, Pet Banner phase.
- **The Wheel of Destiny** (unlock L5): 5 spins/day, first free, later spins cost rising gold. 12-slot prize
  table incl. a 1% jackpot (Legendary or exclusive pet "Gilded Snail"). Table: CONTENT_CATALOG.md §11.

**A modeled "full day" at endgame (~40 min active):** morning: claim mission, start next, arena ×3, shops,
wheel (5 min) · lunch: expedition #1, arena ×3, dungeon attempt (12 min) · evening: expedition #2, arena ×4,
dungeon retries, forge, quests, second wind, queue long mission, start patrol (15–20 min). Idle systems carry
the rest of the day. (Time budget audit: BALANCING.md §8.)

---

## 15. Dungeons (active pillar & wall-clock pacing)

Five key-gated dungeons, **10 floors each**, each floor a named boss (50 bosses at v1.0).

| Dungeon | Unlock | Intended clear window | Set drops (floors 5 & 10) |
|---|---|---|---|
| 1 · Rat Cellars of Brambleford | L12 (story ch. 2 key) | ~L12–25 | L20 class sets |
| 2 · The Sunken Crypt | L25 | ~L25–45 | Innkeeper's Regalia + L20 pity |
| 3 · Ironroot Hollows | L45 | ~L45–70 | L60 class sets |
| 4 · The Obsidian Spire | L70 | ~L70–95 | Twilight Wanderer + L60 pity |
| 5 · Court of the Pale King | L95 | ~L95–130 | L100 class sets |

- **1 attempt per dungeon per hour** (per-dungeon cooldown), attempts are free — bosses are **stat walls**
  tuned ~15–25% above the on-curve player at intended level (BALANCING.md §4): you *will* bounce, buy
  attributes, upgrade gear, and return. This is the heartbeat of mid-game sessions.
- Floor rewards: guaranteed Rare+ (floors 1–4), Epic (6–9), **Set piece + Gems** (5 & 10), first-clear Gem
  bonuses, Codex lore. Dupe-protection: set drops prefer pieces you don't own.
- Boss intro cards (name + one funny threat line) make each wall memorable.

---

## 16. Expeditions (active energy spending — unlock L8)

The **choice-driven** way to spend vigor (S&F expeditions, reimagined):

- Cost **25 vigor**, limit **2/day**. Choose a destination (4 special locales with dedicated background art —
  Castaway Cove, the Crystal Ruins, Watchman's Rest, Pinewatch).
- **5 encounters**; each presents **3 face-down-then-revealed cards**: Fight (~60%) / Treasure (~25%) /
  Event (~15%, quirky choose-outcome vignettes). Encounter 3 = mini-boss option for bonus heroism.
- Picks accumulate **Heroism** → final chest tier: Bronze (<20) / Silver (20–34) / Gold (35+); Gold chests
  can contain set pieces and pet eggs.
- ~10–15% better value per vigor than missions **because you're present** — active play is rewarded, idle
  play is respected (user requirement).

---

## 17. Onboarding (first 15 minutes, scripted; hybrid pacing)

1. **Cold open** (3 illustrated panels, 20 s): your cart breaks down outside Brambleford. The innkeeper waves.
2. **Name + class** pick with live stat/signature preview ("Recommended for newcomers: Warrior" tag).
3. **First mission** (guided, 60 s timer): UI spotlight on the tavern flow → claim → item drop → equip tutorial.
4. **First attribute purchase** (gifted gold), tooltip explains the infinite sink.
5. **First arena bout** vs. "Krellbor the Overconfident" (scripted narrow win, honor explained).
6. Town map reveal → story chapter 1 takes over; each later system unlock (§14 ladder below) triggers a
   15-second contextual tour the first time its screen opens.
- Tutorial missions run 1–3 min; authentic pacing begins at town reveal (~30–60 min in). 
- Veterans: "**I've been here before**" skip (grants identical rewards instantly, marks tutorial achievements done).
- Every screen keeps a **"?"** help overlay forever (static, hand-written, no video).

---

## 18. Unlock Ladder (progressive complexity)

| Level | Unlocks |
|---|---|
| 1 | Tavern, Character sheet, Backpack, story ch. 1 |
| 3 | Patrol |
| 5 | Arena (with mini-rank), Wheel of Destiny |
| 6 | Daily/Weekly/Monthly quest board, Activity chest |
| 8 | Expeditions |
| 10 | Stable (mounts), Weapon Smith, Armorer |
| 12 | Dungeon 1, The Arcanum (potions) |
| 15 | Forge, full Hall of Fame |
| 18 | Wishing Well (gacha) + Login Calendar |
| 20 | First class-set questline (story ch. 3) |
| 25 | Dungeon 2, Codex |
| 35 | Menagerie (pets, story ch. 5) |
| 45 | Dungeon 3 |
| 60 | Reforge at the Forge |
| 70 | Dungeon 4 |
| 95 | Dungeon 5 (v1.0 content frontier) |

Rule of thumb: **something new every 2–4 days of play** for the first two months; the nav rail visibly grows
(locked buildings show as silhouettes with level tags — anticipation is content).

---

## 19. Economy Overview (design intent)

| Currency | Earned from | Spent on | Nature |
|---|---|---|---|
| **Gold** | missions, patrol, arena, quests, selling, wheel | **attributes (infinite)**, shop gear, potions, mounts 1–3, forge gold costs, wheel spins | The engine. Superlinear sinks outpace income → never worthless. |
| **Gems** 💎 | quests (weekly/monthly), activity chest (40%), calendar, achievements, arena milestones, dungeon first-clears, rare mission events | **Wishing Well**, Golden Ale, Ember Drake, cooldown/shop skips | Premium, **never sold for money**, ~30/week steady state (BALANCING.md §6). Every spend is a real decision. |
| **Scraps** | dismantling (5/day), quests, expeditions | Forge upgrades (+1…+20) | Long-term gear bottleneck. |
| **Arcane Dust** | Epic+ dismantles, gacha dupes, deep floors | Reforge (line rerolls) | Perfection currency. |
| **Pet Treats** | missions, patrol, quests, wheel | Pet leveling (1–50) | Companion track. |
| **Honor** | arena wins/losses | *nothing* — pure ranking | Status, not money (S&F principle). |

Faucet/sink audit tables, income-per-day-by-level, and the **anti-rush contract** (simulation-enforced pacing
bounds like "day-30 optimal ≤ level 55") are specified in BALANCING.md §6–§9.

---

## 20. Explicitly Out of Scope for v1.0 (planned post-1.0 — see ROADMAP.md)

AI guilds with chat & duo missions · arena seasons · weekend event system & world boss · The Tower &
companions · homestead/fortress building · deeds/records board · second batch of zones (11–12), dungeon 6,
new sets/pets/mounts · New Game+ "New Worlds" prestige · German localization.

**Hard exclusions forever:** real multiplayer, accounts/servers, real-money purchases, ads, loot boxes for
money, off-device tracking.

---

*Related docs: BALANCING.md · CONTENT_CATALOG.md · UI_DESIGN.md · TECHNICAL_ARCHITECTURE.md · ASSETS.md ·
ROADMAP.md · CLAUDE.md · AGENTS.md*
