# SimpleRPG — Content Catalog (v1.0)

> **Canonical for all content enumerations.** Systems/rules: GAME_DESIGN.md. Numbers: BALANCING.md.
> Every entry here becomes a typed record in `src/content/` (TECHNICAL_ARCHITECTURE.md §8) with a stable
> `id` (kebab-case of the name unless noted). Flavor strings live in the i18n catalog, keyed by id.
> Counts marked **[build-fill]** define required volume; final prose is written during the build milestone,
> following the Writing Guide (§13).

---

## 1. World & places

- Realm: **Aethermoor** · Town: **Brambleford** · Tavern: **The Gilded Tankard** (innkeeper: **Marla Thistlebrew**)
- Town buildings (= nav destinations): The Gilded Tankard (missions/expeditions/patrol board), Arena,
  Hall of Fame plinth, Weapon Smith (**Hammond Forgebright**), Armorer (**Petra Stoutstitch**), The Arcanum
  (**Zinnia Vex**), The Forge (**Old Coalbeard**), Stable (**Wilbur Hay**), Menagerie (**Fenn Whistlewick**),
  Wishing Well, Wheel of Destiny (carnival barker: **Lorenzo the Improbable**), Quest Board, Codex Hall.

## 2. Classes — starting spreads & flavor

| Class | STR/DEX/INT/CON/LCK start | Blurb (i18n key `class.*.blurb`) |
|---|---|---|
| Warrior | 12/8/6/12/7 | "Hits things. Occasionally with a plan." |
| Scout | 8/12/6/10/9 | "Never lost. Frequently 'scenic-routed'." |
| Mage | 6/7/14/8/10 | "Reads books so hard they explode." |
| Assassin | 7/13/7/9/9 | "Two daggers, zero patience." |

## 3. Zones (10) — mission backgrounds mapped to repo assets

| # | Zone | Levels | Background file | Theme & mood | Intended arrival (optimal day) |
|---|---|---|---|---|---|
| 1 | Bramblewood | 1–7 | `mission_background_10.png` | sunny village forest, bridges, deer | day 1 |
| 2 | Millhaven Fields | 8–15 | `mission_background_11.png` | farmland, windmill, distant city | day 2–4 |
| 3 | Blossomvale | 16–24 | `mission_background_12.png` | flower meadows, cottage, spring | day 5–9 |
| 4 | Deepwood Watch | 25–34 | `mission_background_13.png` | dark pines, rope bridges, watchtowers | day 10–18 |
| 5 | Saltmere Coast | 35–44 | `mission_background_14.png` | lighthouse harbor, ships | day 19–30 |
| 6 | Sunscorch Mesa | 45–59 | `mission_background_8.png` | orange canyons, cliff city | day 31–48 |
| 7 | The Ashen Reach | 60–74 | `mission_background_4.png` | barren badlands, sword monuments | day 49–75 |
| 8 | Cinderpeak | 75–89 | `mission_background_6.png` | volcano, bones, war banners | day 76–110 |
| 9 | Frostveil Summit | 90–104 | `mission_background_7.png` | glacier peaks, frozen citadel | day 111–150 |
| 10 | Duskgate | 105+ | `mission_background_5.png` | violet dusk ruins, pale citadel | day 150+ |

Expedition locales (special art, §GAME_DESIGN 16): **Castaway Cove** `bg_1` · **The Crystal Ruins** `bg_2`
· **Watchman's Rest** `bg_3` · **Pinewatch** `bg_9`. Patrol screen: `patrol_background.png`.

## 4. Bestiary — 80 zone monsters (8 per zone; archetypes per BALANCING §4)

| Zone | Monsters (archetype) |
|---|---|
| Bramblewood | Hedge Goblin (Grunt) · Cranky Boar (Brute) · Twig Sprite (Swift) · Bramble Wolf (Grunt) · Mushroom Truant (Grunt) · Apprentice Poacher (Swift) · Bee-Wizard's Swarm (Caster) · **Tobbin the Toll-Troll (Elite)** |
| Millhaven Fields | Scarecrow Awoken (Grunt) · Field Bandit (Swift) · Rogue Ram (Brute) · Crow Conspiracy (Swift) · Turnip Golem (Brute) · Hedge Witch (Caster) · Tax "Collector" (Grunt) · **Old Man Mangel (Elite)** |
| Blossomvale | Pollen Imp (Swift) · Thorn Dancer (Swift) · Honey Slime (Brute) · Petal Charmer (Caster) · Hiveguard Drone (Grunt) · Garden Gnome Ultra (Grunt) · Wasp Baroness (Swift) · **The Overgrown Groundskeeper (Elite)** |
| Deepwood Watch | Shade Lurker (Swift) · Timber Ghoul (Grunt) · Watchfire Wisp (Caster) · Owlbear Cub-Sitter (Brute) · Web Matron (Swift) · Deserter Ranger (Swift) · Moss Troll (Brute) · **The Toll-Troll's Lawyer (Elite)** |
| Saltmere Coast | Dock Rat King-let (Grunt) · Brine Zombie (Grunt) · Gull Tyrant (Swift) · Smuggler First-Mate (Swift) · Tidecaller (Caster) · Barnacle Brute (Brute) · Lighthouse Poltergeist (Caster) · **Captain Undertow (Elite)** |
| Sunscorch Mesa | Dust Devilkin (Swift) · Sun-Baked Bandito (Grunt) · Cactus Shambler (Brute) · Vulture Auger (Caster) · Mesa Stalker (Swift) · Clay Colossus (Brute) · Mirage Twin (Caster) · **Sheriff of Nowhere (Elite)** |
| The Ashen Reach | Ash Revenant (Grunt) · Cinder Hound (Swift) · Monument Golem (Brute) · Bone Chanter (Caster) · Grief Wraith (Caster) · Blackglass Duelist (Swift) · Ash-Choked Giant (Brute) · **The Last Standard-Bearer (Elite)** |
| Cinderpeak | Magma Whelp (Swift) · Obsidian Sentry (Brute) · Fire Cultist (Caster) · Lava Leaper (Swift) · Smoke Shade (Caster) · Basalt Ogre (Brute) · War-Drum Imp (Grunt) · **Kiln-Marshal Vorr (Elite)** |
| Frostveil Summit | Frost Wight (Grunt) · Icicle Lancer (Swift) · Blizzard Hare (Swift, yes really) · Rime Chanter (Caster) · Frozen Sentinel (Brute) · Avalanche Spirit (Brute) · Aurora Wisp (Caster) · **Warden of the White Stair (Elite)** |
| Duskgate | Pale Courtier (Swift) · Gloom Herald (Caster) · Dusk Knight (Brute) · Star-Eaten Scholar (Caster) · Veil Assassin (Swift) · Twilight Mass (Brute) · Lantern-Snuffer (Grunt) · **Herald of the Pale King (Elite)** |

Each monster: `id`, zone, archetype, 1-line codex lore (all 80 written in M6, `i18n/parts/bestiary.json`).
Monsters are met in play: expedition fight cards draw a named monster of the card's archetype from the
hero's frontier zone, and every claimed mission records a sighting (GAME_DESIGN §13).

## 5. Dungeons — 50 floor bosses + set assignments

**D1 · Rat Cellars of Brambleford (L12)** → drops **L20 class sets**
1 Squeaker the Bold · 2 Twitchwhisker · 3 The Cheese Baron · 4 Gnawbone · 5 **Rattigan Prime** ·
6 The Under-Butler · 7 Mold King Sporus · 8 The Whiskered Widow · 9 Tunnel Tyrant · 10 **The Rat King's Rat**

**D2 · The Sunken Crypt (L25)** → **Innkeeper's Regalia** + L20 pity
1 Barnacle Bishop · 2 The Damp Deacon · 3 Coffin Bobber · 4 Silt Prophet · 5 **Abbess of Algae** ·
6 The Pickled Knight · 7 Choir of Bubbles · 8 Reliquary Crab · 9 Drowned Sexton · 10 **Saint Mildew**

**D3 · Ironroot Hollows (L45)** → **L60 class sets**
1 Root-Bound Golem · 2 The Sap Countess · 3 Burrow Baron · 4 Compost Horror · 5 **Ironbark Alpha** ·
6 The Gilded Beetle · 7 Fungal Parliament · 8 Tremor Worm · 9 The Deep Gardener · 10 **Heartwood Regent**

**D4 · The Obsidian Spire (L70)** → **Twilight Wanderer** + L60 pity
1 Glasswork Sentinel · 2 The Mirror Twin · 3 Stair Warden · 4 Volcanic Scribe · 5 **The Archivist of Ash** ·
6 Smoke Chamberlain · 7 The Molten Aviary · 8 Spire Inquisitor · 9 The Penultimate Door · 10 **Magnus Vitrified**

**D5 · Court of the Pale King (L95)** → **L100 class sets**
1 Gatekeeper Morrow · 2 The Bone Sommelier · 3 Pale Jester · 4 Twin Regents · 5 **The Queen's Echo** ·
6 Master of Hounds · 7 The Unlit Chandelier · 8 Chancellor Vane · 9 The King's Conscience · 10 **The Pale King**

Expedition mini-bosses (one per locale + reserves): Captain Flotsam (Cove) · The Crystal Curator (Ruins) ·
Sergeant Nap (Watchman's Rest) · The Pinewatch Impostor · +6 reserve **[build-fill]**.

## 6. Item sets (14), legendaries (8), pets (16), mounts (4)

### 6.1 Sets — pieces & bonuses (values finalized against BALANCING §5)
| Set (class, level, pieces) | 2-pc | 4-pc | Full |
|---|---|---|---|
| Bulwark of the Boar (War, 20, 4) | +armor 10% | — | +block 5 pp; blocks heal 2% HP |
| Ironroot Sentinel (War, 60, 5) | +STR 8% | +armor 15% | after block, next hit +40% |
| Aegis of the Molten King (War, 100, 6) | +STR 10% | +CON 10% | **blocked hits reflect 30%** |
| Thicket Stalker (Scout, 20, 4) | +DEX 6% | — | +evade 3 pp |
| Galewind Pathfinder (Scout, 60, 5) | +DEX 8% | +crit dmg 15% | after evade, guaranteed crit |
| Eyes of the Silent Wood (Scout, 100, 6) | +DEX 10% | +LCK 12% | **first strike always yours + 25% first-strike dmg** |
| Apprentice's Folly (Mage, 20, 4) | +INT 6% | — | +8% weapon dmg |
| Tidebound Scholar (Mage, 60, 5) | +INT 8% | +HP 12% | every 4th strike ×1.6 |
| Regalia of the Hollow Star (Mage, 100, 6) | +INT 10% | +crit 5 pp | **enemy DR capped at 35% vs you** |
| Alleycat's Guise (Asn, 20, 4) | +DEX 6% | — | offhand strike 70% (from 65) |
| Duskveil Shroud (Asn, 60, 5) | +DEX 8% | +evade 5 pp | crits poison: +12% over 2 rounds |
| Masque of the Pale King (Asn, 100, 6) | +DEX 10% | +crit cap 65% | **both strikes crit together = +100% bonus** |
| Innkeeper's Regalia (any, 40, 5) | +gold 10% | +XP 8% | mission item chance +7 pp |
| Twilight Wanderer (any, 85, 6) | +all attrs 5% | +XP 10% | expedition heroism +6; +1 daily expedition |

Piece slots: 4-pc = helm/chest/gloves/boots · 5-pc adds weapon · 6-pc adds belt.

### 6.2 Legendary uniques (8)
Kettle of Endless Soup (talisman — patrol gold +25%) · The Snickering Dagger (Asn offhand — first strike
always crits) · Grandma's Battle Ladle (War weapon — blocks CLANG for 8% reflected) · The Polite Grimoire
(Mage tome — +12% dmg, apologizes) · Boots of Somewhere Else (boots — +8 pp evade) · The Gilded IOU (amulet
— shop prices −15%) · Wheelwright's Lucky Spoke (ring — wheel gem slot +4 pp) · Crown of the Understudy
(helm — +1 all attrs per 10 levels).

### 6.3 Pets (16) — family · rarity · aura (major/minor) · source
| Pet | Family · Rarity | Aura | Source |
|---|---|---|---|
| Ember Fox | Beast · R | +gold find / +DEX | Cinderpeak missions (~2%) |
| Moss Boar | Beast · C | +CON / +armor | story ch. 5 |
| Thicket Hare | Beast · C | +DEX / +evade tiny | Bramblewood missions |
| Ridgeback Wolf | Beast · R | +STR / +crit dmg | Deepwood missions |
| Cinder Wisp | Elemental · R | +crit dmg / +INT | Sunscorch missions |
| Tide Sprite | Elemental · C | +INT / +HP | Saltmere missions |
| Pebble Golem | Elemental · C | +armor / +CON | story ch. 5 |
| Storm Mote | Elemental · E | +XP / +LCK | D3 first-clear |
| Lantern Ghost | Spirit · R | +gold / +XP small | Frostveil missions |
| Hearth Cherub | Spirit · E | +all attrs small / +HP | achievement "Homebody" gold |
| Dream Moth | Spirit · C | +LCK / +item chance tiny | story ch. 5 |
| Grave Owl | Spirit · E | +arena gold / +honor gain | D5 first-clear |
| Snallygaster | Cryptid · E | +dungeon loot luck / +STR | achievement "Wallcrusher" gold |
| Fernwyrm | Cryptid · L | −5% mission time / +DEX | Well pet banner exclusive |
| Moon Calf | Cryptid · L | +treat find / +all tiny | Well pet banner exclusive |
| The Gilded Snail | Cryptid · L | +shop discount 5% / +gold | **Wheel jackpot only** |

### 6.4 Mounts
Barley the Pack Mule (−10%, 5k g) · Dappled Courser (−20%, 75k g) · Bastion Warhorse (−30%, 1.2M g) ·
Ember Drake (−50%, 60 💎). Wilbur Hay keeps the Drake's stall at the far end of the yard, downwind, with
two buckets of sand and an expression of enormous calm. Each mount carries a cosmetic title: **the
Well-Saddled · the Punctual · the Heavily Horsed · the Uninsurable**.

## 7. Wishing Well banners — deterministic 8-week rotation

`bannerIndex = ISOweek mod 8` → Featured set order: W1 Bulwark→ W2 Thicket→ W3 Apprentice's→ W4 Alleycat's
→ W5 Ironroot→ W6 Galewind→ W7 Tidebound→ W8 Duskveil; L100 sets + neutrals enter the pool once the hero
first reaches L85 (rotation then extends to 14). Featured banner auto-selects the set *tier* nearest
(player level + 10). Pet banner phases (biweekly): A = Fernwyrm focus · B = Moon Calf focus.
**Cosmetic frames pool (12).** Eight ship with a base-rotation featured set, so every one of the eight
weeks has a cosmetic to chase; four sit in the general pool and can drop on any frame-carrying banner.
Frames carry no stats *by design* — the one prize the balance model never has to hear about.

| Frame | With | | Frame | With |
|---|---|---|---|---|
| Boarhide Braid | Bulwark Boar | | Ironroot Knot | Ironroot Sentinel |
| Bramble Weave | Thicket Stalker | | Galewind Quill | Galewind Pathfinder |
| Chalk Sigil | Apprentice's Folly | | Tideglass Rim | Tidebound Scholar |
| Gutter Gilt | Alleycat's Guise | | Duskveil Lace | Duskveil Shroud |
| Tavern Brass | general pool | | Pressed Fern | general pool |
| Wishing Stone | general pool | | Moth-Eaten Velvet | general pool |

## 8. Arena rank milestones (first time, per save)

500: 5 💎 · 250: 8 💎 + title "Climber" · 100: 12 💎 · 50: 15 💎 + "Contender" · 25: 20 💎 ·
10: 25 💎 + "Top Ten Terror" · 3: 30 💎 · 1: 50 💎 + title "Grand Champion" + golden profile frame.

## 9. Story — "The Ballad of Brambleford" (8 chapters × 5 steps)

| Ch | Name (level gate) | Beats (5 steps each) |
|---|---|---|
| 1 | Small Beginnings (1) | ledger signing → 3 tutorial missions → first equip → first attribute → Krellbor bout |
| 2 | The Cellar Situation (10) | rat rumors → find cellar key (story mission) → D1 floor 1 → Weapon Smith intro → floor 3 |
| 3 | Dress for Success (20) | set rumor → D1 floor 5 → first set piece → Forge intro → wear 2 set pieces |
| 4 | The Damp Below (25) | crypt key → D2 f1 → expedition to Castaway Cove → D2 f3 → Innkeeper's piece |
| 5 | A Peculiar Menagerie (35) | Fenn's plea → catch Moss Boar → Pebble Golem → Dream Moth → equip a pet |
| 6 | Roots of the Problem (45) | Hollows key → D3 f1 → Sunscorch push → elixir crafting lesson → D3 f5 |
| 7 | The Glass Ladder (70) | Spire key → D4 f1 → reach arena top-100 → reforge lesson → D4 f5 |
| 8 | The Pale Invitation (95) | court key → D5 f1 → Duskgate missions → D5 f5 → **audience with the Pale King** (f10, v1.0 finale) |

Step prose + rewards written in M6 (`content/story.ts`, `i18n/parts/story.json`); every chapter finale
pays gems (5/8/10/12/15/18/20/25 by chapter) + its unique title. **Chapters gate by level and advance
independently** — see GAME_DESIGN §12.3. Chapter 5 needs pets, so it waits for M7.

## 10. Achievements (70) — category · counts (tiers bronze/silver/gold at thresholds)

- **Progression (12):** Level 10/25/50/75/100/125 · zones 3/6/10 · story ch. 2/5/8
- **Combat (14):** arena wins 10/100/1000 · win streak 5/10 · crits 100/1k/10k · blocks 500 · evades 500 ·
  dungeon floors 5/25/50 · flawless boss kill · win with <5% HP
- **Collection (12):** codex 10/50/100% pages · pets 4/10/16 · sets 1/5/14 completed · legendaries 1/4/8 ·
  frames 3/12
- **Economy (10):** gold earned 100k/10M/1B · attrs bought 100/1k/5k · 10M single purchase · forge +20 ·
  dismantles 100 · shop sprees 50 buys · sell a legendary (title: "the Regretful")
- **Exploration (10):** missions 50/500/2500 · expeditions 10/100 · gold-tier chest ×10 · patrol hours
  100/1000 · every expedition locale · 100% one zone's bestiary
- **Mastery (8):** wheel jackpot · pity a set piece · L50 no deaths · beat a boss 10 levels up ·
  max elixirs 7 days straight · arena 10/10 days ×30 · calendar 28/28 · activity 100 ×100 days
- **Secrets (4):** click the well 50× ("Wishful Thinker") · lose to Krellbor rematch · pet the innkeeper's
  cat 30 days · read every codex lore entry

Rewards per GAME_DESIGN §13 (+3 all attrs/tier; gems on gold tiers; titles on signature feats).

## 11. Wheel of Destiny (12 slots, weights /100)

Gold S 20 · Gold M 12 · Gold L 5 · XP 15 · Random item 10 · Scraps 12 · Treats ×3 8 · Dust 6 ·
**1 Gem 8** · Mystery (re-roll another slot doubled) 2 · **Jackpot 1** (Legendary; if all 8 owned → Gilded
Snail; then 25 💎) · "The wheel salutes you" 1 (nothing + funny line).

## 12. Bots — name & guild corpus

- **Fantasy style (45%):** first parts ×40 (Ael, Bryn, Cael, Dra, Elow, Fenn, Gor, Hal, Isen, Jor, Kael,
  Lyra, Mor, Nym, Ola, Pryn, Quill, Ryn, Syl, Thal, Ulf, Vael, Wyn, Xan, Yor, Zeph, Ash, Bram, Corv, Dun,
  Ember, Fal, Grim, Hazel, Iron, Juni, Kest, Lark, Mab, North) + last parts ×40 (…dor, …wyn, …grim, …ella,
  …ric, …wick, …mere, …thorn, …bane, …low, …shade, …brook, …fell, …hart, …stone, …vale, …weld, …born, …gale,
  …iron, …leaf, …march, …nock, …pike, …quist, …rowan, …sky, …thistle, …under, …vane, …ward, …wood, …yarrow,
  …zell, …ash, …bell, …crow, …dawn, …ford, …holt)
- **Gamer style (40%):** cores ×40 (Shadow, Dragon, Toxic, Pixel, Turbo, Mega, Silent, Crazy, Dark, Epic,
  Ninja, Ghost, Hyper, Ultra, Sneaky, Salty, Cosmic, Rusty, Spicy, Frosty, Lucky, Grumpy, Swift, Iron,
  Chaos, Rogue, Void, Neon, Doom, Fluffy, Angry, Sleepy, Blaze, Storm, Venom, Wicked, Zero, Alpha, Omega,
  Potato) + patterns: `Xx{core}xX`, `{core}{2-4 digits}`, `{core}_{core2}`, `The{core}`, `{core}HD`,
  leetify 8% (a→4, e→3, o→0), lowercase 20%.
- **Roleplay style (15%):** `{Fantasy} the {Adjective}` (adjectives ×20: Bold, Unwashed, Patient, Sleepy,
  Magnificent, Frugal, Loud, Humble, Untippable, Relentless, Cautious, Giddy, Stalwart, Wandering, Sly,
  Honest-ish, Thorough, Unlucky, Caffeinated, Ready).
- **Guild tags (20, cosmetic v1.0):** [FORGE] [MOSS] [WYRM] [OATH] [GRIN] [HEXE] [RUNE] [SALT] [DUSK] [ALE!]
  [BONK] [OWL] [PYRE] [THRN] [VOID] [YAWN] [GLHF] [BRB] [NOPE] [KEG]
- Collision handling: append digits. Player-name profanity/impersonation filter: none needed (offline), but
  bot generator excludes the player's chosen name.

## 13. Flavor-text Writing Guide + required volumes **[build-fill]**

Voice: warm, dry, a little absurd; jokes about adventuring logistics, never about the player. 1–2 sentences.
PG. No real-world brands/IP. Examples (zone 1): "Somebody taught the boars to queue. It's unsettling — deal
with it." · "The toll-troll now accepts exposure as payment. He would prefer gold."

| Pool | Volume | Keys |
|---|---|---|
| Mission offers | 6/zone + 12 generic = 72 | `mission.z{z}.{i}` |
| Patrol tick events | 20 | `patrol.tick.{i}` |
| Expedition events (choose-1-of-2 outcomes) | 24 ✅ M5 | `exped.event.{i}` |
| Arena defeat/victory quips | 15 + 15 | `arena.win/lose.{i}` |
| Boss intro threats | 50 ✅ M5 | `boss.{id}.intro` |
| Codex monster lore | 80 ✅ M6 | `monster.{id}.lore` |
| Loading/reset tips | 25 | `tips.{i}` |

## 14. Elixirs (The Arcanum)

Minor/Standard/Grand Elixir of {Strength, Dexterity, Intelligence, Constitution, Luck} — +10/15/25% of that
attribute, 24h, 3 slots, no duplicate attribute; prices BALANCING §5.4. Icons tinted per attribute.

## 15. Login calendar rewards (28 slots, monthly)

D1 gold ·2 scraps ·3 treats ·4 gold ·5 elixir ·6 dust ·**7: 3 💎** ·8 gold ·9 scraps ·10 arena chest ·
11 treats ·12 gold ·13 elixir ·**14: 5 💎** ·15 scraps ·16 gold ·17 dust ·18 treats ·19 gold ·20 arena chest
·**21: 7 💎** ·22 gold ·23 elixir ·24 scraps ·25 dust ·26 treats ·27 big gold ·**28: cosmetic frame
(monthly rotation ×12) + 10 💎**.
