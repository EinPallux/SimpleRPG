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
| Missions ~250 vigor | 25.0 | the backbone |
| Patrol 8–11h | 2.4–3.3 | 0.3/h; sim-measured ≈ 20–25% of mission income without ale |
| Arena 10 wins | 6.0 | + chests |
| Quests/activity | 3.5 | avg |
| Wheel (net) | −1.5 | costs > direct gold EV (it pays in items/gems/treats) |
| Selling drops | ~0.05 | pocket change (sim-measured ≈ 0.2% of missions) — loot's value is equipping & scraps, not vendoring |
| **Total ≈ 36 M10/day** | | |

*The faucet/sink split is asserted by the sim (`gold-faucet audit` scenario): attributes must absorb
≥ 60% of earned gold; patrol/missions and selling/missions ratios must stay in their bands.*

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
arena milestones 8×, dungeon first-clears 55×, story). 
**Gem sinks:** 10-toss 45 · Golden Ale up to 70/wk (optimizer ceiling) · Ember Drake 60 · skips 1–3/day.
Design check: a player choosing gacha-only can 10-toss ~every 1.5 weeks; an ale-maxing optimizer forgoes
gacha — real tension, no dominant strategy (sim scenario `gem-strategies`).

**Codex/achievement passive caps:** total bonuses from all permanent sources capped at +30% XP · +40% gold
find · +8% all-attr (pet collection) · +15 all-attr per 10 achievements-tier average — engine-enforced.

---

## 7. Wishing Well odds (per toss)

| Result | Standard | Featured | Pet banner |
|---|---|---|---|
| Consumable bundle (gold/scraps/treats/potion) | 55% | 55% | 49% |
| Rare gear | 25% | 25% | 25% |
| Epic gear | 12% | 12% | 12% |
| **Set piece** | 5% | 5% (→ **75% featured set**) | 4% |
| Pet egg | 2% | 2% | **6%** (→ 50% banner pet) |
| Legendary | 1% | 1% | 1% |
| Cosmetic frame (from consumable slot, 3%) | — | included | included |

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
| `optimal-7d` | **level ≤ 27** |
| `optimal-30d` | **level ≤ 55** |
| `optimal-90d` | **level ≤ 90** |
| `optimal-180d` | **level ≤ 118** |
| `casual-30d` (60% vigor, no ale, 6 arena) | level in **[35, 48]** (fun floor AND ceiling) |
| `dungeon-final` | Court of the Pale King floor 10 **not clearable before day 140** optimal |
| `ladder-rank1` | rank 1 reachable **day 170–270** optimal; top-100 by day ~75 ± 15 |
| `gem-strategies` | ale-max vs gacha-max vs drake-first end-state power within 12% at day 120 |
| `zone-frontier` | each zone unlock reached within ±20% of its intended day (§CONTENT 3) |

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
| 2026-07-28 | §6 audit corrected from sim measurement (M3): selling ≈ 0.05 M10/day (was 2.5), patrol 2.4–3.3 | first real audit run showed drop-vendoring is ~0.2% of mission income (sell = 20% of ilvl^1.75 vs missions ∝ L^1.9) — accepted as design: loot's value is equipping + dismantling, not gold | no constant changed; `gold-faucet audit` scenario added to CI |

*(Every future tuning PR appends a row here.)*
