# SimpleRPG — UI/UX Design System & Screen Specifications

> Canonical for visual language, components and screens. The whole chrome is built from
> **Kenney Fantasy UI Borders** (already in `game_assets/UI/Kenney_FantasyUIBorders/`, CC0) tinted to our
> palette, over a dark navy canvas with the low-poly zone backgrounds providing warmth and place.
> Vibe target: the S&F screenshots in `game_assets/examples/` — ornate frames, dark panels, chunky friendly
> text — executed in a **cleaner, modern flat style** (owner-approved art direction).

---

## 1. Design principles

1. **Frame = meaning.** Border style + tint communicates hierarchy (primary/secondary), rarity, and class.
   Never decorate arbitrarily.
2. **One glance, one truth.** Every screen answers: what can I do *right now*, what am I waiting on, what
   did I get. Timers, badges and claim-dots do the talking.
3. **Numbers feel physical.** Count-ups, floaters, chest-pops — but ≤ 400 ms, skippable, and calm when the
   user enables reduced motion.
4. **Desktop-first, thumb-friendly.** ≥1024 px is the reference; everything reflows to 360 px, tap targets
   ≥ 44 px, no hover-only affordances.
5. **The world stays warm.** Dark UI, but every screen carries a piece of painted Aethermoor (background
   art, panel headers, NPC one-liners). It's a place, not a dashboard.

## 2. Design tokens (`src/styles/tokens.css`)

```
--canvas:#0E1420  --panel:#16202E  --panel-raised:#1B2838  --panel-inset:#0B111B
--ink:#E8E3D5  --ink-muted:#9AA5B5  --ink-faint:#5E6A7A
--gold:#D9A94B  --gold-bright:#F0C75E  --teal:#3FA7A0  --danger:#C0483F  --success:#57B65F
--vigor:#E0A23F  --hp:#C0483F  --xp:#57B65F  --honor:#B08FD9  --gem:#7FD1C8
rarity: --r-common:#9AA3AD  --r-uncommon:#57B65F  --r-rare:#4C8BE0  --r-epic:#A64CE0
        --r-legendary:#E08A2E  --r-set:#35C99A
class:  --c-warrior:#D96A45  --c-scout:#6FA85A  --c-mage:#5B8DD9  --c-assassin:#9B6DD9
spacing: 4-px grid · radius: none (frames define edges) · shadow: 0 4px 16px #0009 on raised panels
```

**Typography** (self-hosted via @fontsource, OFL): Display **Cinzel** (screen titles, section headers,
"SIMPLERPG" wordmark — letter-spaced, gold). UI/body **Nunito Sans** (600/700/800) with
`font-variant-numeric: tabular-nums` on all counters. Scale: 12/14/16 (base)/20/24/32/40.
Number formatting: `1,234` < 100k · `123.4k` · `12.34M` · `1.23B` (locale-aware helper).

## 3. The Frame System (Kenney borders, 9-slice)

Source PNGs are **white line-art on transparency, 48×48, 1-bit** → perfect for build-time tinting
(`scripts/optimize-assets.mjs` generates colored variants; slice geometry verified there, nominal
`border-image-slice: 16 fill; border-image-width: 16px` rendered at 2× for crispness).

| Token class | Source (Default family) | Tint | Used for |
|---|---|---|---|
| `.frame-primary` | `Transparent center/panel-transparent-center-007` | gold | main screen panels, modals |
| `.frame-secondary` | `…-013` | silver-blue (#8FA3BC) | nested panels, lists, tabs |
| `.frame-slot` | `…-001` | per-rarity | item slots, portrait frames |
| `.frame-button` | `…-004` | gold / muted | buttons (see FButton) |
| `.frame-special` | `…-029` | arcane teal | Wishing Well, event surfaces |
| `.frame-danger` | `…-021` | danger red | dungeon bosses, confirmations |
| `.frame-legendary` | `Double/…-007` | animated gold shimmer | legendary/set reveals, rank-1 |
| dividers | `Divider/divider-002`, `Divider Fade/…-002` | gold 40% | section separators |

Rules: max two frame styles per screen region; tint = semantic only (never decorative rainbow); panel
interiors always `--panel`/`--panel-raised` gradients, never pure black; frames scale in 8-px steps.

**Iconography:** game-icons.net SVGs (CC BY 3.0 — credited in-game, see ASSETS.md) recolored flat:
`--ink` default, context tint on hover/active. Currency glyphs: gold coin, gem (teal), scrap (steel),
dust (violet), treat (bone), vigor (tankard ⭐ flavor), honor (laurel). Class + attribute icons fixed set.

## 4. Component inventory (`src/ui/components/`)

| Component | Notes / key props |
|---|---|
| `Panel` | `variant` (primary/secondary/special/danger), `title?`, `headerRight?`, collapsible on mobile |
| `FButton` | `variant` (primary/quiet/danger/gem), `size`, `cooldownUntil?` (radial sweep), `cost?` (renders CurrencyChip inline, auto-disables + shake-on-poor) |
| `CurrencyChip` | icon + animated value; `delta` floaters (+120 🪙); click → tooltip with today's sources |
| `StatRow` | label, value, `+`-buy button w/ cost, per-attribute tint, achievement/potion bonus breakdown tooltip |
| `ItemSlot` | rarity frame, ilvl badge, upgrade "+n", set glyph, pips (0–5 corner dots = rarity, colorblind-safe), empty-state silhouette |
| `ItemTooltip` | full card + **live compare vs equipped** (green/red deltas), source line, sell/dismantle value |
| `ProgressBar` | variants: xp/hp/vigor/heroism/activity; label-in-bar; `animateFrom` |
| `TimerBar` | derives from `{startedAt,duration}`, 1 Hz, "Skip (1💎)" affordance slot |
| `TabBar`, `Modal`, `Drawer`, `Toast`, `Tooltip`, `Badge` | standard, frame-styled; toasts stack max 3 |
| `EmblemAvatar` | procedural portrait: bg palette × icon × frame; sizes 24–96 |
| `LadderRow` | rank, emblem, name+guild tag, class icon, level, honor; player-highlight; virtualized list |
| `RewardReveal` | sequential chest-open: items fly to slots, rarity flash, gem sparkle (Kenney VFX sprites) |
| `CombatPlayback` | two portraits, HP bars, floating numbers, round ticker, 1×/2×/skip |
| `CoachMark` | onboarding spotlight + copy, anchored, dismiss-once persisted |
| `EmptyState` | illustration + one-liner + primary action ("The board is bare. Come back at dawn.") |
| `NumberTicker` | rAF count-up, respects reduced-motion |

## 5. App shell & navigation

```
┌────────────────────────────────────────────────────────────────────────────┐
│ HUD  [Emblem+Name+Title]  [Lv 42 ▓▓▓▓░ XP]   🪙 123.4k  💎 62  ⚙ 234  ✨ 18 │
│                                    ⚡ Vigor 85/100 (+Second Wind!)  [⚙][?] │
├──────────┬─────────────────────────────────────────────────────────────────┤
│ NAV RAIL │                                                                 │
│ ADVENTURE│                                                                 │
│  🍺 Tavern (2!)      ← claim badge                                          │
│  🧭 Expeditions      │            ACTIVE SCREEN                            │
│  🛡 Patrol (zZ)      │   (zone background art, content panels)             │
│ COMBAT   │                                                                 │
│  ⚔ Arena (7/10)     │                                                     │
│  🏰 Dungeons (1 rdy) │                                                     │
│  🏆 Hall of Fame     │                                                     │
│ TOWN     │                                                                 │
│  ⚒ Shops · 🔨 Forge · 🐴 Stable · 🐾 Menagerie · ⛲ Wishing Well · 🎡 Wheel │
│ HERO     │                                                                 │
│  👤 Character · 📜 Quests (1!) · ⭐ Achievements · 📖 Codex · 📅 Calendar   │
└──────────┴─────────────────────────────────────────────────────────────────┘
```
- Rail groups mirror GAME_DESIGN §2 loop. Locked entries = silhouette + "Lv 35" tag (anticipation).
  Badges: claimable (gold dot + count), ready (green), timer (mini countdown on hover).
- **Mobile:** top HUD condenses to two rows; rail becomes bottom tab bar: Tavern · Combat · Town · Hero ·
  More (sheet). Active timers float as a persistent chip above the tab bar.
- Global surfaces: Settings modal (audio sliders, reduced motion, instant-combat, number format, save
  export/import, credits), "?"-help overlay per screen, patch-notes modal on version change.

## 6. Screen specifications (24)

Each screen lists: purpose · layout · key interactions · states. All use `Panel` grammar above; every
screen has a designed empty/loading/locked state (no blank panels, ever).

1. **Title / Save Slots** — wordmark over Bramblewood art; 3 slot cards (emblem, name, class, level, last
   played); New/Continue/Import; slot delete = typed confirmation.
2. **Character Creation** — split: name + class carousel (4 cards: signature blurb, stat spread bars,
   "recommended" tag on Warrior) + emblem picker (12×4 grid) → "Sign the ledger" CTA with quill flourish.
3. **Onboarding overlays** — CoachMark sequence per GAME_DESIGN §17; skippable; never blocks input outside
   its spotlight.
4. **Tavern (Missions)** — hero screen. Left: 3 mission offer cards (zone art thumb, flavor line, duration,
   rewards row, LUCKY/STORY ribbons); center-bottom: active mission TimerBar with destination art panorama;
   right: zone pin selector + reroll button + Second Wind tankard (glows when unclaimed) + Golden Ale ×5
   tracker. Claim = RewardReveal. Empty vigor → gentle push to Patrol/Arena.
5. **Expedition** — destination select (4 locale cards) → run view: 5-step path (icons fill), 3 encounter
   cards flip on reveal, heroism meter, chest-tier preview ("14 more heroism to Gold"). Fight cards open
   CombatPlayback inline (fast mode).
6. **Patrol** — `patrol_background.png` full-bleed; guard NPC; accrual meter (ticks collected/next tick),
   collected-so-far pouch, funny tick log feed; Start/Collect/Stop. Locked while vigor ≥ 5 with tooltip.
7. **Arena** — 3 opponent cards (EmblemAvatar, name+tag, class, level, honor delta preview, win-chance hint
   as words: "even fight", "risky", "safe"), fights-left pips, cooldown radial, sparring toggle after 10;
   result → CombatPlayback → honor delta ticker + milestone toasts.
8. **Hall of Fame** — virtualized ladder, sticky player row, jump-to-me/top, class filter, search;
   row click → Profile Peek modal (gear grid, attrs, honor sparkline, "Fight" if in arena range).
9. **Character** — S&F-style: left = paper-doll (10 ItemSlots around EmblemAvatar, mount + pet chips
   below), right = StatRows with buy-buttons (hold-to-repeat, cost preview, "next 10" toggle), potions (3
   sockets), resistances/derived panel (DPS estimate, crit, block/evade, DR). Title picker under name.
10. **Backpack** — 30-slot grid (+5 achievement slots rendered as carved extensions), sort/filter chips
    (rarity/slot/new), multi-select for bulk sell/dismantle with total preview; drag-to-equip with valid-
    slot highlighting; full → oldest-common auto-sell prompt (opt-in).
11. **Weapon Smith / Armorer / The Arcanum** — shared shop template: NPC portrait + daily line; 6 stock
    cards (ItemSlot + price + compare glyph), refresh countdown to midnight, free-reroll button (then 1💎);
    Arcanum adds elixir rack (3 tiers × 5 attributes, active-potion sockets mirrored).
12. **Forge** — three benches as tabs: Upgrade (slot item → +n preview, success always, cost curve chart),
    Dismantle (5/day pips, yield preview), Reforge (L60; line picker, dust cost). Coalbeard commentary.
13. **Dungeons** — 5 dungeon cards (art tint, floor progress 6/10, cooldown radial, next-boss intro line);
    enter → floor view: boss card (name, threat line, archetype glyphs), "Fight" → CombatPlayback →
    win: RewardReveal + floor++ · loss: "wall" feedback with delta hints ("His armor shrugged off 41% of
    your damage — Strength or upgrades?").
14. **Wishing Well** — `.frame-special`; banner carousel (Featured/Standard/Pet) with rotation countdown,
    odds table (always visible, no toggle), pity meters as water-level in the well art, single/10× toss;
    toss animation: coin arc → ripple → orbs rise → RewardReveal (skippable). Free daily toss glow.
15. **Menagerie** — pet grid (16 silhouettes → discovered art), equipped pet stage with aura summary,
    treat-feeding (hold to feed, level bar), collection bonus meter, source hints on locked pets.
16. **Stable** — 4 mount stalls, owned/locked, effect + price, equip toggle; Ember Drake stall has gem
    shimmer + "the big decision" tooltip comparing vs. gacha (honest UI).
17. **Quest Board** — three pinned boards (Daily ×3 with swap-one, Weekly ×3, Monthly ×2 with big
    progress bars) + Activity meter → Daily Chest; story chapter banner on top with current step and
    "guided arrow" deep-link to the relevant screen.
18. **Achievements** — category tabs, tier cards with progress, claim-all button, attribute-total summary
    ("Achievements grant you +87 to all attributes"), title equip shortcuts.
19. **Codex** — book UI: Bestiary/Armory/Menagerie/Stable/Vault tabs, page-completion % with bonus
    readouts, entry hover → lore + kill counter; overall completion on the cover.
20. **Wheel of Destiny** — carnival frame, 12-slot wheel (canvas-free CSS conic segments), spin
    costs escalate visibly, Lorenzo barks results; jackpot = full-screen confetti (VFX sprites).
21. **Calendar** — 28-slot board with month theme tint, claim ritual (stamp animation), gem days
    highlighted, "days visited this month" counter.
22. **Combat Playback overlay** — per §4; also hosts fight summary card (damage, biggest crit, rounds,
    seed copy button in dev builds).
23. **Settings** — audio (master/music/sfx), motion, instant-combat, timers as absolute/relative,
    save slots (export/import/delete), credits & licenses (ASSETS.md list rendered), version + patch notes.
24. **Error / "Tavern fire" screen** — friendly art, Copy Debug Report, reload; never a white page.

## 7. Motion & juice (framer-motion + CSS)

- Screen transitions: 160 ms fade+4 px rise; panels stagger 40 ms. Reward moments budget: chest 900 ms
  full sequence, skippable by tap.
- Floaters: damage numbers arc 600 ms; currency deltas rise from their chip.
- VFX sprite dictionary (Kenney particles): crit `star_07` burst · block `spark` flash · evade `smoke_03`
  puff · legendary `magic_05` swirl · gem `twirl_02` glint · levelup `light_02` column.
- Ambient: tavern hearth flicker (2% brightness sine), well water shimmer, wheel idle sway — all CSS,
  all disabled under `prefers-reduced-motion` (motion tokens: `--motion-fast:120ms --motion-base:200ms`).
- Audio map (howler sprites, ASSETS.md §5): ui_click, ui_deny, coin_burst, chest_open, rarity stingers ×3,
  crit_hit, block_clang, levelup_fanfare, wheel_tick, well_splash; music: town loop / combat sting /
  night patrol loop. Master default 70%, music 40%; mute persists.

## 8. Accessibility & responsiveness

- Full keyboard map (arrows/enter in grids, `1–9` quick-nav rail, `Esc` closes overlays); visible gold
  focus ring (`outline: 2px var(--gold-bright)`).
- ARIA: timers as `aria-live=off` with on-demand announce; RewardReveal announces summary text; ladder rows
  as table semantics.
- Colorblind-safe: rarity pips (§4 ItemSlot), class icons beside class colors, win-chance words not colors.
- Text scaling to 125% without clipping (test gate); hit areas ≥ 44 px; no information in hover-only.
- Breakpoints: ≥1280 comfy (rail labels visible) · 1024–1279 rail icons · 768–1023 rail collapses to
  drawer · <768 bottom tabs + stacked panels; combat playback goes vertical.
- PWA install prompt after day-2 login ("Pin Aethermoor to your home screen?") — never on first session.
