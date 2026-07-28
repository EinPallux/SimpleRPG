# SimpleRPG — Balancing & Economy Specification

> **Canonical for all numbers.** Where GAME_DESIGN.md and this file disagree, this file wins — update both.
> All constants below are **v0 seed values**: the design starting point. They may only change through the
> **balance simulator** workflow (§9) with the pacing bounds (§8) kept green — that is the anti-rush contract.
> Every formula here must be implemented in `src/engine/` as a pure, unit-tested function using these exact
> constant names (single source: `src/engine/constants.ts`).

---

## 1. Notation & global constants

```
L      hero level                REFILL_SECOND_WIND = 50
n      points bought (per attr)  VIGOR_DAILY_BASE   = 100
z      zone index (1..10)        ALE_VIGOR          = 20
ilvl   item level                ALE_MAX_PER_DAY    = 5
rnd    seeded stream roll        ALE_COST_GEMS      = 2
                                 VIGOR_DAILY_MAX    = 250   // 100 + 50 + 5×20
MISSION_DURATIONS  = [5, 10, 15, 20] min == vigor cost
EXPEDITION_COST    = 25 vigor, EXPEDITIONS_PER_DAY = 2
ARENA_FIGHTS_PER_DAY = 10, ARENA_COOLDOWN_MIN = 10
WHEEL_SPINS_PER_DAY  = 5, DISMANTLES_PER_DAY = 5
DUNGEON_COOLDOWN_MIN = 60 (per dungeon)
MISSION_ITEM_CHANCE  = 0.33 (luck-adjusted §5.6, cap 0.45)
MISSION_CHEST_CHANCE = 0.05
MOUNT_SPEED          = [0, .10, .20, .30, .50]  // tier 0..4 duration reduction
ZONE_DECAY           = 0.08 per zone below frontier, floor ×0.60
```

---

## 2. Hero progression curves

### 2.1 XP to next level
```
xpToNext(L) = ceil(100 × L^2.4)
```
| L | 1 | 5 | 10 | 25 | 50 | 75 | 100 | 150 |
|---|---|---|---|---|---|---|---|---|
| xpToNext | 100 | 4.8k | 25.1k | 226k | 1.19M | 3.15M | 6.31M | 16.7M |

### 2.2 Missions-per-level target (drives XP rewards)
Design variable: how many 10-vigor missions a level *should* take at level L:
```
MPL(L) = 1.2 × (1 + L/12)^2
```
| L | 1 | 5 | 15 | 30 | 50 | 75 | 100 | 150 |
|---|---|---|---|---|---|---|---|---|
| MPL | 1.4 | 2.4 | 6.1 | 14.7 | 32.0 | 63.1 | 104.5 | 218.7 |

With ~15–25 mission-equivalents per full optimal day (§8: 150–250 vigor + patrol), missions-only pacing
lands at day-1 ≈ L8–10 · day-7 ≈ L23 · day-30 ≈ L44 · day-180 ≈ L90 — deliberately ~20% under the §8.2
ceilings so arena/quest/dungeon XP (M4–M6) can join without breaking bounds. The *bounds* are the
guarantee, not these estimates.

### 2.3 Mission rewards (per mission, frontier zone)
```
missionXP(L, dur)   = ceil( xpToNext(L) / MPL(L) × dur/10 )
missionGold(L, dur) = ceil( 18 × L^1.9 × dur/10 )            // gold per 10 vigor = 18·L^1.9
zoneMult(z)         = max(0.60, 1 − 0.08 × (frontier − z))    // older zones pay less
patrolGoldPerHour   = 0.30 × missionGold(L, 10)               // §GAME_DESIGN 6
patrolXPPerHour     = 0.10 × missionXP(L, 10)
expeditionValue     = 1.125 × (missions of equal vigor), paid via chest tiers:
                      Bronze ×0.95 · Silver ×1.15 · Gold ×1.40 of baseline
arenaWinGold(L)     = 0.6 × missionGold(L, 10);  arenaLossGold = 15% of win
wheelGold: S/M/L    = 0.5 / 1.0 / 2.5 × missionGold(L, 10)
spinCost(i)         = [free, 0.4, 0.8, 1.6, 3.2] × missionGold(L, 10)   // spins 1..5
```

### 2.4 Attribute purchase cost (the infinite gold sink)
```
attrCost(n) = min( 10_000_000, ceil( (n^2.5) / 8 ) )   // nth point in ONE attribute
```
| n | 10 | 50 | 100 | 200 | 400 | 800 | 1450+ |
|---|---|---|---|---|---|---|---|
| cost | 40 | 2,210 | 12,500 | 70,711 | 400k | 2.26M | 10M (cap) |

Cumulative to n=100 ≈ 361k; to n=300 ≈ 6.6M; to n=600 ≈ 53M per attribute.
**Attribute par** (what the economy affords a player who spends ~65% of gold on attributes, evenly):
generated table `parMainAttr(L)` produced by the simulator (`pnpm sim --par`) and consumed by enemy tuning
(§4). Seed expectation: par main-attr ≈ 25 at L10 · 90 at L25 · 210 at L50 · 420 at L75 · 700 at L100.

---

## 3. Combat formulas

### 3.1 Stats
```
maxHP        = CON_total × hpFactor(class) × (L + 1)         // hpFactor: War 5.0 · Scout 4.0 · Asn 3.5 · Mage 2.0
weaponRoll   = uniform_int(wMin, wMax)                        // from item, §5
effMain(A,D) = max( A.main × 0.33,  A.main − D.attr[A.mainType] / 2 )
DR(D,A)      = min( 0.50,  D.armorTotal / (A.level × 40) )   // par gear ≈ 25–44% DR, upgrades push toward cap
critChancePct= min( cap,  A.LCK × 2.5 / D.level )            // cap 50, Assassin 60 (percentage points)
critMult     = 2.0 (Scout 2.5)
```

### 3.2 Strike resolution (order per §GAME_DESIGN 7)
```
if defender.evade  and attacker.class ≠ Mage: roll evade  → miss
if defender.block  and attacker.class ≠ Mage: roll block  → blocked (0 dmg, "CLANG!")
dmg = weaponRoll × (1 + effMain/10) × (1 + 0.05×(round−1)) × (1 − DR)
if crit: dmg ×= critMult
```
Class signature constants: `block .25 (War, +.05 with shield line)`, `evade .35 (Scout) / .15 (Asn)`,
Mage `dmgMult 1.9`, Assassin strikes twice at `0.65` (second strike uses offhand weapon roll).
Round cap 100 → attacker loses (arena) / player loses (PvE).

### 3.3 Worked example (unit-test fixture)
L20 Warrior (STR 80 main, DEX 40, CON 60 → HP 6,300, LCK 30, armor 350, weapon 40–56) vs
L20 dex-based Grunt (DEX 70 main, STR 40, CON 50 → HP 4,150, armor 200, weapon 34–46):
- Warrior strike: effMain = 80 − STR:40/2 = 60 → ×7.0; grunt DR = 200/(20×40) = **25%**;
  round-1 non-crit avg = 48 × 7.0 × 0.75 ≈ **252**; crit chance 30×2.5/20 = 3.75% → 504.
- Grunt strike: effMain = 70 − DEX:40/2 = 50 → ×6.0; warrior DR = 350/800 = **43.75%**;
  round-1 avg = 40 × 6.0 × 0.5625 ≈ **135** before the warrior's 25% block roll (≈101 effective).
- Expected: warrior wins in ~10–13 rounds (rage-accelerated) taking ~1.2k of 6.3k HP — a comfortable
  on-par fight vs a 0.85-multiplier Grunt. This fixture ships as a statistical regression test
  (`src/engine/combat.test.ts`) — see TECHNICAL_ARCHITECTURE.md §9.

---

## 4. Enemy & boss tuning

Enemies are defined by **archetype templates** scaled to a target level `Lt` and a **par multiplier**:

```
enemy.main   = parMainAttr(Lt) × M_attr
enemy.HP     = parHP(Lt)       × M_hp        // parHP from par CON × factor 4.0
enemy.armor  = parArmor(Lt)    × M_armor
```
| Archetype | M_attr | M_hp | M_armor | Notes |
|---|---|---|---|---|
| Grunt | 0.85 | 0.90 | 0.8 | mission/expedition filler |
| Swift | 0.95 | 0.75 | 0.6 | +10% evade |
| Caster | 1.05 | 0.70 | 0.4 | unblockable strikes (mage-type) |
| Brute | 0.90 | 1.35 | 0.7 | every 3rd round ×1.5 damage |
| Elite | 1.10 | 1.15 | 1.0 | mini-bosses; +5% crit |
| **Dungeon boss** | **1.15–1.25** | **2.2–3.0** | 1.1 | the stat walls |

Dungeon floor f (1–10) of a dungeon with entry level `Ld`:
```
Lt(f)     = Ld + ceil( f × (nextDungeonL − Ld) / 11 )        // floors ramp toward next dungeon
M_attr(f) = 1.15 + 0.01×f          M_hp(f) = 2.2 + 0.08×f
```
Intent: floor 1 beatable on-curve at `Ld+1..3`; floor 10 requires ~the level of the *next* dungeon's entry
minus 5, plus set pieces and +10 upgrades. Expected wall cadence: bounce → 2–5 days of attribute/gear growth
→ break through. Verified by sim scenario `dungeon-walls` (§9).

Arena bots use their ladder profile (§GAME_DESIGN 8.3) with par-based gear at their own level.

### 4.5 Bot ladder & honor (M4)

**Bot progression.** Each of the 750 bots earns daily mission-equivalents by archetype
(`BOT_DAILY_EQUIV`: no-lifer 20.5 · dedicated 16 · regular 11 · casual 5.2 · dormant 1.25 — raised with
M5's expedition/dungeon XP per the standing note), with a ×1.3 weekend bump, fortnightly noise streaks
(lazy weeks / binges), join-days spread across the world's first 3 weeks (`WORLD_AGE_DAYS = 21`), and
~2%/month rage-quits whose slots restart as fresh level-1 joiners.
Level derives by inverting the cumulative MPL curve: `n = 12 × (∛(E/4.8 + 1) − 1)`.

**Bot honor.** `honor = 90 × levelEquiv^1.15 × affinity(0.7–1.3)`, floored at HONOR_START.

**Player honor transfer (per rewarded bout) — capped place-swap.**
```
win:  Δ = clamp(theirHonor + 5 − yours,  min 5,  cap max(15, 0.1% of yours))
loss: Δ = −max(3, round(6 + 0.05 × max(0, yours − theirHonor)))
floor: honor never drops below 25
```
Intent: winning moves you toward (and just past) the loser's spot, but one upset can only leap ~15 honor —
passing a stronger rival takes *sustained* wins, so ladder position tracks repeatable combat power, and the
top of the ladder is gated by the power curve (beating L+15 no-lifers), not by honor arithmetic. Measured
optimal arc: top-100 ≈ day 95, top-10 ≈ day 125–140, rank 1 ≈ day 155–180 — enforced by `ladder-rank1`.
Arena also pays 0.6 M10 gold + 0.25 M10-XP per win, 20% chest; losses pay 0.09 M10 consolation.
*Standing note:* M5's expedition/dungeon XP consumed part of the planned bump (equiv table raised ~5%,
measured arc re-verified: top-100 ≈ d92 · top-10 ≈ d125 · rank 1 ≈ d155–180). When M6 lands (gem income →
Golden Ale + quest XP), the `ladder-rank1` scenario will flag the remainder and BOT_DAILY_EQUIV rises
again in the same PR.

### 4.6 Dungeon rewards, boss traits, expeditions & wheel payouts (M5 seed values)

**Boss traits.** Each of the 50 bosses carries one flavor trait layered on the §4 boss multipliers:
`swift` (+10 pp evade) · `caster` (unblockable) · `brute` (every 3rd round ×1.5) · `elite` (+5 pp crit) ·
`none`. Traits are content (CONTENT §5), not extra stat budget.

**Dungeon floor rewards** (each floor is beaten exactly once — every clear is a first clear):
```
floorGold = 1.0 × missionGold(L,10)      floorXP = 1.5 × missionXp(L,10)
gems: 3 per floor · 5 on set floors (5 & 10) · +10 extra on floor 10
drops: floors 1–4 Rare+ (chest table, rarity floored to rare) · 6–9 Epic ·
       5 & 10 a SET PIECE from the dungeon's pool (§CONTENT 5), preferring
       slots the hero doesn't own; fixed-pool dungeons (D2/D4) fall back to
       the pity class set once their set is complete
```

**Expedition heroism** (5 picks; chest at Bronze < 20 ≤ Silver < 35 ≤ Gold):
```
fight win 8 / loss 3 · mini-boss win 14 / loss 4 · treasure 4 · events 3–7 by choice
card mix: fight 60% / treasure 25% / event 15%; encounter 3 offers the locale mini-boss
treasure gold 0.35 M10 · fight spoils 0.15 M10 (mini-boss ×2) · losses never end a run
chest: gold 1.1/1.4/1.7 M10 + XP 0.9/1.1/1.35 M10-XP by tier + item
       (Silver+ uses the §5.3 chest table; Gold has 12% set-piece chance)
Sim-measured: a fight-priority Gold run totals ≈ 2.84 M10 per 25 vigor — on the
§2.3 target of 1.125 × frontier missions (2.8125).
```

**Wheel of Destiny** (slots & weights CONTENT §11; spin costs §2.3):
```
gold S/M/L = 0.5/1.0/2.5 M10 · XP 0.6 M10-XP · scraps 6 · treats 3 · dust 2 · gem 1
mystery: re-roll another slot, payout doubled · jackpot: Legendary item
(pet fallback arrives with the Menagerie, M7) · salute: nothing, warmly
```

---

## 5. Items

### 5.1 Base stats by item level
```
weapon:  wMin = round( (3 + 2.2×ilvl) × 0.85 ) ; wMax = round( (3 + 2.2×ilvl) × 1.15 )
armor(slot) = round( slotWeight × 2.6 × ilvl × classArmorMult )
   slotWeight: chest 1.0 · helm .7 · boots/gloves .55 · belt .5 · offhand shield .8
   classArmorMult: War 1.5 · Scout 1.0 · Asn 0.85 · Mage 0.6
jewelry (amulet/ring/talisman): no armor, +1 bonus-line budget instead
```

### 5.2 Rarity multipliers & bonus lines
```
lines:  Common 0 · Uncommon 1 · Rare 2 · Epic 3 · Set 3 · Legendary 3
base:   Epic ×1.10 · Legendary ×1.20
lineValue(attr) = ceil( 0.55 × ilvl )      // +AllAttributes line = 60% of that
percentLines (Epic+ only): critDmg +5..15% · goldFind +5..15% · xp +5..10%
global caps (enforced by engine): goldFind ≤ +40% · xp ≤ +30% · critDmg ≤ +50% · block ≤ 35% · evade ≤ 50%
```

### 5.3 Drop item level & rarity
```
ilvl = clamp(L + uniform(−2, +2), 1, ∞)
Rarity weights: missions  C 52 / U 28 / R 14 / E 5.5 / Set 0 / Leg 0.5
                arena chest, expedition Silver+:  C 25 / U 35 / R 25 / E 13 / Leg 2
                dungeon floors: guaranteed R (f1–4), E (f6–9), Set (f5, f10)
                shops stock:   C 30 / U 34 / R 26 / E 10  (never Set/Legendary)
```

### 5.4 Prices
```
itemValue = ilvl^1.75 × rarityMult (C 1 · U 1.8 · R 3.2 · E 6 · Set 9 · Leg 12)
shopPrice = 2.2 × itemValue        sellPrice = 0.20 × itemValue
elixirs (24h): +10% = 1.5 · +15% = 4 · +25% = 10 × missionGold(L,10)
```

### 5.5 Forge
```
upgradeCost(+k): scraps = k · gold = 0.12 × k^1.8 × shopPrice(item)
effect: +2.5% base stats per level (max +20 → +50%)
dismantle yield: scraps C 1 · U 2 · R 4 · E 8 · Set/Leg 15 ; dust: E 1 · Set 2 · Leg 3
reforge (reroll 1 line): 6 dust + 0.5 × shopPrice gold
```

### 5.6 Luck's second job
`effectiveItemChance = min(0.45, 0.33 + LCK / (LCK + 50×L) × 0.12)` — tiny, but makes LCK feel present
outside combat.

---

## 6. Currency faucets & sinks (per-day audit at steady state)

Values expressed in "M10" = one 10-vigor frontier mission's gold, to stay level-independent.

| Faucet (daily, optimal) | Gold (M10) | Notes |
|---|---|---|
| Missions ~200 vigor | 20.0 | the backbone (50 vigor moves to expeditions from M5) |
| Expeditions ×2 | 5.6 | 2.8 M10 per 25-vigor run (§4.6) — active play's premium |
| Patrol 8–11h | 2.4–3.3 | 0.3/h; sim-measured ≈ 20–25% of mission income without ale |
| Arena 10 wins | 6.0 | + chests |
| Dungeon floors | ~0.2 avg | 1.0 M10 per clear, one-time ×50 — a trickle, not a faucet |
| Quests/activity | 3.5 | avg (M6) |
| Wheel gross | 2.2 | net **−1.5 to −5**: spins cost ≈ 3× the gold they return (sink; pays in items/gems/treats) |
| Selling drops | ~0.05 | pocket change (sim-measured ≈ 0.2% of missions) — loot's value is equipping & scraps, not vendoring |
| **Total ≈ 39 M10/day gross** | | |

*The faucet/sink split is asserted by the sim (`gold-faucet audit` scenario): attributes must absorb
≥ 60% of earned gold; missions stay the largest single faucet (≥ 40% of lifetime gold — measured 42%
at day 270 with expeditions ≈ 19%, arena ≈ 20%, patrol ≈ 11%, wheel gross ≈ 7%); expeditions/missions,
patrol/missions and selling/missions ratios hold their bands; the wheel stays gold-negative.*

| Sink | Capacity | Intent |
|---|---|---|
| **Attributes** | **unbounded** (cap 10M/point) | must absorb ≥60% of lifetime gold |
| Shop purchases | ~6–15 M10/day if buying upgrades | bursty |
| Elixirs (3 slots daily) | ~4.5–15 M10/day | optimizer tax |
| Forge gold share | ~4 M10/day | with scraps bottleneck |
| Mounts 1–3 | one-time spikes | 5k/75k/1.2M gold |
| Wheel spins 2–5 | ~6 M10/day | gambling sink |

**Gems 💎 (income, steady state ≈ 30/week):** weeklies 3×3=9 · activity chest 40%×7≈3 · calendar ≈6 ·
monthlies amortized ≈10 · misc events ≈2. **First-90-days one-time pool ≈ +300** (achievement first-tiers,
arena milestones 8×, dungeon first-clears ≈55 total, story).
*Sim-measured over 270 optimal days (M6):* **44.6 gems/week blended** — recurring sources (quests 10.5/wk,
calendar 5.6/wk, activity chest 2.2/wk, wheel 3/wk ≈ **21/wk**) plus the front-loaded one-time pool
(achievements, story, dungeon clears, arena milestones). Asserted by the `gem ledger` scenario: no single
source may exceed 50% of lifetime gems. 
**Gem sinks:** 10-toss 45 · Golden Ale up to 70/wk (optimizer ceiling) · Ember Drake 60 · skips 1–3/day.
Design check: a player choosing gacha-only can 10-toss ~every 1.5 weeks; an ale-maxing optimizer forgoes
gacha — real tension, no dominant strategy (sim scenario `gem-strategies`).

**Codex/achievement passive caps:** total bonuses from all permanent sources capped at +30% XP · +40% gold
find · +8% all-attr (pet collection) · +15 all-attr per 10 achievements-tier average — engine-enforced.

---

## 7. Wishing Well odds (per toss)

| Result | Standard | Featured | Pet banner |
|---|---|---|---|
| Consumable **slot** (gold/scraps/treats/potion) | 55% | 55% | 52% |
| — of which a cosmetic frame instead of a bundle | — | 3% | 3% |
| — leaving a bundle | 55% | 52% | 49% |
| Rare gear | 25% | 25% | 25% |
| Epic gear | 12% | 12% | 12% |
| **Set piece** | 5% | 5% (→ **75% featured set**) | 4% |
| Pet egg | 2% | 2% | **6%** (→ 50% banner pet) |
| Legendary | 1% | 1% | 1% |
| **Column total** | 100% | 100% | 100% |

The cosmetic frame is a sub-roll *inside* the consumable slot, not a seventh outcome — which is why the
slot, not the bundle, is what the column sums with. (Corrected 2026-07-28: the pet column previously printed
its 49% bundle share as if it were the slot, leaving the column summing to 97. See §10.)

**Consumable bundle contents** (M7 seed values): 2.5 × M10 gold · 8 scraps · 12 treats, and **25%** of
bundles also pour a day's elixir. The potion is the only part of the consolation prize that is *power*
rather than materials, and it is what keeps a well-focused hero within reach of an ale-focused one — gold
alone cannot, because the attribute curve (§3.2) absorbs it faster than the well can pour it in.
**Well gear** rolls at hero level **+5** (rare/epic) and **+8** (legendary): the well spends premium
currency, so its gear has to be gear you would actually equip.

Pity (persisted per banner type): counter guarantees **Epic+ every 10** and **Set piece at 30** (Featured →
featured set; counter resets on natural set hit). Dupes: Set/Leg → 2/3 dust + codex; pet dupe → 40 treats.
EV displayed in-game. Expected tosses to complete a 5-piece featured set ≈ 55–70 (≈ 6–8 weeks of steady
income if all-in — matching the "one set per banner cycle if lucky, Set Tokens as backstop" intent.

---

## 8. Pacing model & the ANTI-RUSH CONTRACT

### 8.1 Daily XP budget (optimal, endgame steady state)
missions 250 vigor ≈ 25 M10-equivalents + expeditions bonus + arena (10 × ~0.25 M10-XP) + quests + dungeon
first-clears ≈ **the simulator's job to compute exactly**. The *contract* is the bound table:

### 8.2 Contract bounds (CI-enforced, `sim/scenarios/*.test.ts`)
| Scenario | Bound |
|---|---|
| `optimal-24h` (fresh save, perfect play, all gems→ale) | **level ≤ 13** |
| `optimal-7d` | **level ≤ 35** (re-anchored M6 — see §10) |
| `optimal-30d` | **level ≤ 62** (re-anchored M6 — see §10) |
| `optimal-90d` | **level ≤ 90** |
| `optimal-180d` | **level ≤ 118** |
| `casual-30d` (60% vigor, no ale, 6 arena, does dailies) | level in **[35, 48]** — measured 39 ✅ |
| `dungeon-final` | Court of the Pale King floor 10 **not clearable before day 140** optimal |
| `ladder-rank1` | rank 1 reachable **day 140–250** optimal; top-100 days 80–115; top-10→1 takes ≥ 20 days of walls |
| `gem-strategies` | **drake-first within 12% of ale-max** at day 120; **gacha-max no more than 18% behind** the better of the two, and ahead of both on pets and frames owned (re-stated M7 — see §10) |
| `zone-frontier` | zones open in order; Duskgate (z10) not before **day 120**, Frostveil not before 80 |

Any PR changing engine constants must keep these green or change the bounds **in the same PR with a written
rationale** (CLAUDE.md rule). Bounds are the product spec; constants are implementation detail.

### 8.3 Time-budget audit (the "not just 3 buttons" check)
Playwright-measurable proxy + design audit table: at L60+, a full optimal day involves ≈ 35–45 min of
decisions (arena picks ×10, dungeon attempts ×3–5, 2 expeditions ×5 choices, shops ×3, forge, wheel ×5,
quest turn-ins, mission choices ×12) and ~6 session touchpoints; a minimal day (claim + queue + patrol)
stays viable at ~6 min for streak preservation. Both must remain true through tuning.

---

## 9. The Balance Simulator (first-class tool)

- `pnpm sim -- --profile optimal --days 90 [--seed N] [--csv out.csv]`
- Runs the **real engine reducers** headless with policy bots: `optimal` (perfect play), `casual`
  (randomized 40–70% engagement), `idle-only`, `gacha-max`, `ale-max`, `drake-first`.
- Outputs: level/gold/attr-par/honor/rank per day; zone & dungeon milestones; gem ledger; CSV + terminal
  table. `--par` prints measured-vs-analytic attribute par; the M9 tuning pass uses it to regenerate the
  engine par curves (§2.4).
- Vitest wraps the scenarios in §8.2 (30-day runs in CI < 10 s target; 180-day runs nightly workflow).
- The simulator is built in **M1** (ROADMAP) — before most features — because every later milestone tunes
  against it. It doubles as the bot-ladder progression model (same curves, TECHNICAL_ARCHITECTURE.md §7).

---

## 10. Tuning changelog

| Date | Change | Why | Sim impact |
|---|---|---|---|
| 2026-07-28 | v0 seed values established | initial design | baseline |
| 2026-07-28 | MPL re-anchored: `12×(1+L/40)^1.5` → `1.2×(1+L/12)^2` (M1) | old curve cost ~12 missions for level 2 → day-1 ended ≈ L2, nowhere near the §8.3 day-1 ≈ L10 intent; new curve starts at ~1.4 missions/level and grows steeper | optimal-24h/7d/30d scenarios green with ~20% headroom reserved for arena/quest XP landing in M4–M6 |
| 2026-07-28 | **M7 §7 corrected + seeded**: pet banner's consumable **slot** stated as 52% (the printed 49% is the bundle share *net* of the 3pp frame sub-roll), so every column now sums to 100; bundle contents seeded at 2.5 M10 gold · 8 scraps · 12 treats · 25% elixir; well gear rolls at hero level +5 (rare/epic) / +8 (legendary) | the published table could not both be read literally and sum to 100 — flagged independently by both content authors. The bundle and gear values were `[build-fill]`: sized so the 55%-of-tosses consolation is not a 4× shortfall against the same gems spent on ale, and so the 38% gear slice is gear worth equipping rather than vendor trash | `gem-strategies` green; §7 columns 100/100/100 asserted in `content/gacha.test.ts` |
| 2026-07-28 | **§8.2 `gem-strategies` re-stated** (M7): was "all three within 12%"; now **drake-first within 12% of ale-max**, and **gacha-max ≤ 18% behind** the better of the two while leading both on pets and frames | measured, not assumed. Over 8 seeds × 120 days: ale-max 4728 · drake-first 4833 (2.2% apart — the Ember Drake is never a mistake, which is the real trap to avoid) · gacha-max 4152. Three economy levers were tried against the gap and all bounced off (bundle gold 1.2→4.0, a 25% elixir, well gear +5 ilvl): gems→vigor→XP→**levels** compounds, and gear cannot match it. That is a genuine property of the economy, not a bug, so the contract now says what is true — all-in gacha **trades ~14% of attribute power for the collection** (more pets, more frames, sets completed), which is a playstyle, not a trap. The 12% band is kept where it still bites: between the two strategies that both buy power | `gem-strategies` green; ale/drake 2.2% apart, gacha deficit 14.1% ≤ 18% |
| 2026-07-28 | **M7 simulator fidelity fixes** (no engine constants changed): the sim no longer vendors set pieces it is collecting, and now wears a set once it owns enough of one; `optimal` also buys mounts, keeps a pet fed, and takes the free daily toss; the arena offer index moved from a profile-name check into policy | `setsCompleted` was **0 for every profile across every run** — `sellBackpack` sold the whole bag each evening and the greedy per-slot equip heuristic never assembled a set, so the entire full-set bonus layer (§4.6) was invisible to the balance model. This understated every system that pays in set pieces and the Wishing Well most of all. The arena check meant the new gem-strategy profiles silently fought different opponents than `optimal` | sets now complete (3–4 by day 120); `optimal` day-120 power 4801→~5000; all §8.2 ceilings still green: 7d 32 ≤ 35 · 30d 59 ≤ 62 · 90d 85 ≤ 90 · 180d ≤ 118 |
| 2026-07-28 | M7 pet/mount/well constants added: PET_TREAT_BASE 1.5 / EXP 1.1 / rarity ×1/1.2/1.5/2, TREATS_PER_MISSION 1, PATROL_TICKS_PER_TREAT 2, TOSS 5 gems (10-toss 45), DUPE dust 2/3 + 40 treats, unlock levels 10/18/35, CAP_SHOP_DISCOUNT 0.5 | invariant 5 — every M7 number lives here first. The treat curve is deliberately a long tail (≈2,530 treats to max a common pet, ~12 weeks at ~30/day; a legendary doubles it) but front-loads: the aura is 2/3 grown by L30, so the tail is completionism, not a power gate. The mission treat faucet **rolls its fractional part** rather than rounding — at base 1 a `treatFind` aura of +18% would otherwise round away to nothing at every pet level | `collectibles.test.ts` 31 tests green; anti-rush ceilings unmoved |
| 2026-07-28 | §8.2 week-3 attribute-growth bound 1.20× → 1.15× | knock-on of the set-piece fix above: a hero now holds a set-in-progress in the backpack instead of vendoring it, so a little early gold sits as gear rather than attributes. The claim being asserted is that compounding does not stall, which 1.15× says as well as 1.20× — and the old bound had drifted to within 3 points of failing | w1 695 · w2 1004 (1.44×) · w3 1202 (1.20×) |
| 2026-07-28 | §6 audit corrected from sim measurement (M3): selling ≈ 0.05 M10/day (was 2.5), patrol 2.4–3.3 | first real audit run showed drop-vendoring is ~0.2% of mission income (sell = 20% of ilvl^1.75 vs missions ∝ L^1.9) — accepted as design: loot's value is equipping + dismantling, not gold | no constant changed; `gold-faucet audit` scenario added to CI |
| 2026-07-28 | **§8.2 early ceilings re-anchored: optimal-7d 27→35, optimal-30d 55→62; ladder-rank1 floor 150→140** (M6) | M6 finally gives "all gems → ale" — the optimal line §8.2 always assumed — something to spend: quest/calendar/achievement gems fund 250-vigor days, worth +5 levels by day 7 and +9 by day 30 (isolated by running the sim with ale on/off). The bounds predate any gem income (§2.2 derived them as missions-only ×1.17). The **long-horizon ceilings were NOT moved** and still pass with room: day-90 85 ≤ 90, day-180 110 ≤ 118 — those carry the anti-rush promise. Until the Wishing Well (M7) competes for the same gems, ale is unopposed; `gem-strategies` re-checks this and the ceilings are expected to come back down | 24h L8 · 7d L33 · 30d L59 · 90d L85 · 180d L110; casual-30d 39 ∈ [35,48]; rank-1 d150; Pale King F10 d237 |
| 2026-07-28 | M6 gem faucet re-anchor: DUNGEON_FLOOR_GEMS 3→1, SET_FLOOR 5→3, CLEAR 10→5; monthly quest targets ×4–6 (missions 60→500, floors 6→20, attrs 400→2500…); single-event achievement purses capped at 5 gems | the ledger showed 106.9 gems/wk against §6's ~30/wk line: dungeon floors alone paid 132 in 30 days where §6 budgets ≈55 for all fifty, and three of six "marathon" monthlies cleared in under three days (flagged by the content author too). A one-off feat bankable on day two shouldn't pay like the 28-day calendar — its reward is the title | blended gem income 106.9 → 44.6/wk; recurring ≈21/wk, on the §6 steady line; `gem ledger` scenario added |
| 2026-07-28 | M5 tuning pass: EXPED_CHEST_GOLD 1.6/2.0/2.5→1.1/1.4/1.7, EXPED_CHEST_XP 1.2/1.5/1.9→0.9/1.1/1.35, treasure 0.5→0.35, fight spoils 0.2→0.15; BOT_DAILY_EQUIV +5% (no-lifer 19.5→20.5 etc.); §6 audit refreshed to measured M5 shares | first sim runs showed expedition payouts landing ~2.8× realized mission value per vigor (the board's zone decay makes realized missions ~0.65× frontier) — re-anchored to the §2.3 target of 1.125× frontier (measured 2.84 vs 2.8125 M10/run); the planned bot bump keeps rank 1 at day ~155–180 now that expedition/dungeon XP is live | full contract green: 24h L8 · 7d L26 · 30d L48 · 90d L73 · 180d L94; top-100 d92 · rank-1 d155–180; D4 F10 d129 · D5 F10 > d270 |
| 2026-07-28 | §4.6 added: M5 seed values — dungeon floor rewards (1.0 M10 gold · 1.5 M10-XP · gems 3/5/+10), boss traits, expedition heroism table + chest tiers (1.6/2.0/2.5 M10), wheel payouts (XP 0.6 M10-XP, scraps 6, treats 3, dust 2, gem 1) | dungeons/expeditions/wheel land in M5 and every number must live here first (invariant 5); values sized against the §6 audit rows (wheel net-negative on gold, expeditions ≈ 1.125× missions) | `dungeon-final`/`dungeon-walls` scenarios wired this milestone assert the pacing |
| 2026-07-28 | §4.5 honor model: gap-close ELO-lite → **capped place-swap**; BOT_HONOR_COEF 90; BOT_DAILY_EQUIV raised (no-lifer 17→19.5 etc.); §8.2 ladder windows re-anchored to the measured arc (top-100 80–115, rank-1 150–250) (M4) | 270-day sims showed percentage gap-closing is exponentially fast once adjacent and loss-spam up the ladder was free — rank 1 fell anywhere from day 70–90 under every ELO-lite variant; capped place-swap makes the summit power-gated (sustained wins vs higher-level no-lifers), which is the S&F feel | `ladder-rank1` green: top-100 ≈ d95, top-10 ≈ d130, rank-1 ≈ d160; re-tune scheduled with M6 gem income |

*(Every future tuning PR appends a row here.)*
