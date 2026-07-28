# SimpleRPG — Technical Architecture

> Canonical for stack, structure, persistence, time, RNG, and quality gates. Game rules: GAME_DESIGN.md.
> Numbers: BALANCING.md. The architecture's guiding constraint: **100% client-side, deterministic where it
> matters, deployable as static files on Vercel, maintainable by AI agents in small verifiable slices.**

---

## 1. Stack (and why)

| Layer | Choice | Rationale |
|---|---|---|
| Build | **Vite 6** | Static SPA — the whole game is client state; no SSR/server components needed. Fast HMR, trivial Vercel static deploy. (Next.js rejected: adds server mental model for zero benefit here.) |
| UI | **React 19 + TypeScript (strict)** | Componentized screens, huge ecosystem, agent-friendly. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` on. |
| State | **Zustand + Immer** (slice per domain) | Minimal boilerplate, selector-based re-renders, easy to test reducers as pure functions. |
| Persistence | **IndexedDB via Dexie** | Saves > 1 MB possible (localStorage too risky). Debounced autosave + rotation. |
| Validation | **Zod** | Save-file schema versioning/migration + content validation at build time. |
| Styling | **Tailwind CSS 4** + CSS custom properties + 9-slice `border-image` utilities | Token-driven theme (UI_DESIGN.md §2). No runtime CSS-in-JS. |
| Animation | **framer-motion** (UI) + CSS keyframes (ambient) | Combat playback, reward reveals, screen transitions; `prefers-reduced-motion` respected. |
| Audio | **howler.js** | Sprite-based SFX, music channel, user-gesture unlock, per-channel volume persisted. |
| Dates/time | Native `Date` + tiny helpers | One clock module; **no moment/dayjs** dependency needed. |
| PWA | vite-plugin-pwa | Installable, offline-capable (fits the "check in 5× a day" habit). |
| Tests | **Vitest** (+ Testing Library) · **Playwright** | Engine/economy unit tests, component tests, E2E smoke, **balance simulation suite**. |
| Lint/format | ESLint (typescript-eslint, react-hooks) + Prettier | CI-enforced. |
| Package manager | **pnpm** | Fast, strict. |

Non-goals: no backend, no accounts, no analytics/telemetry, no service calls at runtime (CSP-friendly),
no WebGL/canvas engine (DOM+CSS suffices for this UI-driven game; Kenney VFX particles render as DOM sprites).

## 2. Repository layout (target)

```
/                      # planning docs (this suite), config
├── index.html
├── vercel.json        # SPA rewrite → /index.html, immutable asset caching
├── public/
│   └── assets/        # optimized runtime assets (generated from game_assets/ by script)
├── game_assets/       # SOURCE assets (kept pristine; not shipped as-is)
├── scripts/
│   └── optimize-assets.mjs   # game_assets → public/assets (tint 9-slice frames, AVIF/WebP, icon sprite)
├── src/
│   ├── main.tsx, App.tsx
│   ├── engine/        # PURE game logic — no React, no DOM, no Date.now() inside functions
│   │   ├── constants.ts          # every constant from BALANCING.md, same names
│   │   ├── rng.ts                # seeded streams (§5)
│   │   ├── combat.ts             # simulateCombat(a, b, seed) → CombatLog
│   │   ├── stats.ts, items.ts, loot.ts, economy.ts, xp.ts
│   │   ├── missions.ts, patrol.ts, expedition.ts, dungeon.ts, arena.ts
│   │   ├── gacha.ts, wheel.ts, quests.ts, achievements.ts, codex.ts, pets.ts
│   │   ├── botworld.ts           # deterministic ladder derivation (§7)
│   │   ├── time.ts               # reset boundaries, offline catch-up planner (§6)
│   │   └── generated/par.ts      # attribute-par table (sim-generated, committed)
│   ├── sim/           # balance simulator: policies, scenarios, CLI (pnpm sim)
│   ├── state/         # zustand slices: hero, inventory, activities, town, meta, settings, ui
│   ├── persist/       # dexie db, save codec (export/import), migrations/v1.ts…
│   ├── content/       # typed catalogs (CONTENT_CATALOG.md): zones.ts, monsters.ts, sets.ts, …
│   ├── i18n/          # en.json + t(); all user-facing strings, incl. content flavor keys
│   ├── ui/
│   │   ├── components/  # design system (UI_DESIGN.md §4): Panel, FButton, ItemSlot, …
│   │   ├── screens/     # one folder per screen (UI_DESIGN.md §6)
│   │   ├── overlays/    # tooltips, modals, onboarding coach marks, combat playback
│   │   └── hooks/       # useGameClock, useTimer, useSound, useCoachMark
│   └── styles/        # tailwind config, tokens.css, nine-slice.css
└── .github/workflows/ci.yml   # typecheck → lint → unit+sim → build → e2e smoke
```

**Dependency rule (enforced by eslint boundaries):** `ui → state → engine → (constants, content types)`;
`engine` imports nothing from `state`/`ui`; `content` is data-only. The engine must run headless in Node
(that's what the simulator and tests do).

## 3. State model

- One Zustand store composed of slices; **all mutations happen in named actions** that call pure engine
  functions and then persist. No setState from components directly.
- Derived values (DPS preview, set-bonus totals, codex %, ladder rank) computed via memoized selectors —
  never stored.
- `GameSave` (persisted shape) is versioned and zod-validated:

```ts
interface GameSave {
  version: number;                // SAVE_VERSION, migrations registry
  createdAt: string; lastSeenAt: string;  // ISO; anti-tamper §6
  worldSeed: string;              // bot world + name gen
  rngState: Record<StreamName, XoshiroState>; // §5 — persisted, save-scum resistant
  hero: { name; classId; level; xp; attrsBought; gold; gems; scraps; dust; treats;
          honor; titleId?; portrait: EmblemSpec; potions: ActivePotion[] };
  inventory: { equipped: Partial<Record<Slot, ItemInstance>>; backpack: ItemInstance[]; capacity: number };
  activities: { mission?: TimedActivity; expedition?: ExpeditionRun; patrol?: PatrolState;
                dungeonCooldowns: Record<DungeonId, string>; arena: { fightsToday; cooldownUntil } };
  daily: { vigor; secondWindUsed; aleUsed; wheelSpins; dismantles; freeRerolls; freeToss;
           activity: number; questIds: string[]; questProgress: Record<string, number> };
  weekly / monthly: {...quest state}; calendar: { monthKey; claimedDays: number[] };
  progress: { storyStep; zonesUnlocked; dungeonFloors: Record<DungeonId, number>;
              setsSeen; codex: CodexState; achievements: Record<string, TierState>;
              pets: Record<PetId, { owned: boolean; level: number }>; equippedPet?; mountTier;
              gachaPity: Record<BannerType, PityState>; milestonesClaimed: string[] };
  stats: LifetimeCounters;        // for achievements/records
}
```
- `ItemInstance` = `{ id, defId, ilvl, rarity, lines: BonusLine[], upgrade: number, seed }` — cosmetic/re-
  derivable parts derived from `seed` to keep saves lean.

## 4. Persistence & saves

- **3 save slots** (separate Dexie rows) + slot metadata (name/class/level/screenshot-free summary).
- Autosave: debounced 1 s after any action; forced on `visibilitychange → hidden` and before export.
- **Rotation**: keep last 3 autosave snapshots + 1 daily backup per slot (corruption insurance).
- **Export/import**: base64(JSON + CRC32) `.simplerpg` file download / file-picker + paste-box import;
  version-migrated on import; import replays no RNG (state carried in save → save-scumming by re-import
  yields identical outcomes).
- Migrations: `migrations/vN.ts` pure functions, tested with fixture saves per version.

## 5. Randomness (seeded, streamed, fair)

- PRNG: **xoshiro128\*\*** seeded via splitmix64 from `worldSeed`; state serialized in save.
- **Named streams** so systems can't starve each other: `combat`, `loot`, `missions`, `gacha`, `wheel`,
  `botworld`, `cosmetic`. Drawing from one never advances another.
- Gacha/pity and wheel results derive from persisted stream state → reload/export tricks can't reroll.
- Combat takes an explicit `seed` (drawn once from `combat` stream, stored in the fight record) → full
  replay/playback determinism and shareable "fight seeds" in bug reports.

## 6. Time engine (the game's spine)

- Single `clock.ts` authority: `now()` injectable for tests/sim; all activities stored as
  `{ startedAt: ISO, durationSec }` — remaining time always derived, never counted down in state.
- **Offline catch-up** on load/focus (pure planner in `engine/time.ts`): walk from `lastSeenAt` to now →
  complete finished missions (banked, unclaimed), accrue patrol ticks (cap 8 h), then apply each crossed
  **daily/weekly/monthly boundary in order** (multi-day gaps correct: quests expire, calendar advances one
  claimable day max, vigor resets each midnight but only the final day is spendable — matching design).
- **Resets**: daily = local midnight; weekly = Monday 00:00; monthly = 1st 00:00 (GAME_DESIGN §14 lists
  affected systems — implemented as one `applyDailyReset(save)` family of pure functions).
- **Clock-tamper guard**: if `now < lastSeenAt − 10 min` → enter `timeFrozen` mode (timers paused, banner
  shown: "Aethermoor's sun is confused") until wall clock passes `lastSeenAt` again; DST/timezone travel
  tolerated via ±26 h grace on *forward* jumps (no penalty ever — guards only prevent farming, never punish).
- Active tab: 1 Hz `useGameClock` tick drives timer UIs; no per-frame state churn.

## 7. Bot world (deterministic, storage-free)

- `botworld.ts` derives, for any `(worldSeed, dayIndex)`: the full 750-bot ladder — id, name, guild tag,
  class, emblem, archetype, level, honor. **Nothing persisted** except the seed; day 400 costs the same as
  day 1 (O(bots) with per-day memo cache).
- Progression model reuses the simulator's casual/regular/dedicated policy curves (BALANCING §9) with
  per-bot noise streams: weekend bumps, streaks, dormancy, ~2%/month churn (departed bots replaced by fresh
  low-level names — derived, again, from the seed).
- Bot inspect: gear/attributes derived from `(botId, levelBand)` via par tables → stable between views.
- Arena opponent offers: pure function of (ladder snapshot, player honor, `arena` stream) → 3 picks near
  player rank. Fight uses the standard combat engine with the bot's derived kit.

## 8. Content pipeline

- Each catalog file exports `const zones: readonly ZoneDef[]` etc. with zod schemas beside the types.
- `pnpm validate:content` (a Vitest suite over `src/content`, run in CI): unique ids, referential integrity (set pieces
  reference real item defs; dungeon drops reference real sets; quests reference real activities), curve
  monotonicity, banner rotation covers all sets, i18n key existence for every content id, icon refs exist.
- Content is **versioned by patch tag** (`contentVersion`) enabling post-1.0 patch diffs and save-forward
  compatibility (a save may reference retired ids → migration maps or graceful "legacy item" handling).
- Flavor strings live in `i18n/en.json` (keys per CONTENT_CATALOG §13) — **English-only at v1.0, structure
  i18n-ready** (t() everywhere, no concatenated sentences, ICU-style plurals).

## 9. Testing & quality gates

| Layer | Tool | Must cover |
|---|---|---|
| Engine unit | Vitest | every formula in BALANCING.md incl. §3.3 fixture; property tests (fast-check) for combat termination, non-negative damage, cap enforcement |
| Economy/sim | Vitest (fast) + nightly long runs | **all §8.2 contract scenarios**; content validation |
| Components | Testing Library | Panel/ItemSlot/Tooltip/Timer render + a11y roles |
| E2E | Playwright | smoke: create hero → tutorial → first mission (mock clock) → claim → equip → arena fight → save/reload integrity; offline catch-up scenario with clock jump |
| Perf | Lighthouse CI (budget) | LCP < 2.5 s mid-tier mobile, initial JS < 350 KB gz, route chunks lazy |
| A11y | axe in Playwright | no serious violations on core screens |

CI (GitHub Actions): typecheck → lint → unit+content+sim(30d) → build → Playwright smoke → Lighthouse
budget. Nightly: 180-day sim scenarios. **A PR that touches `engine/constants.ts` must update
BALANCING.md §10 changelog** (checked by a CI grep-gate).

## 10. Performance & assets at runtime

- `scripts/optimize-assets.mjs`: backgrounds → 1280w/1920w AVIF+WebP (≤ 200 KB each); Kenney border PNGs →
  single spritesheet + generated `nine-slice.css`; icons → SVG sprite with `currentColor` fills (tintable);
  VFX particles → trimmed sheet. Source `game_assets/` never ships raw.
- Screens code-split via `React.lazy`; next-likely screens prefetched on idle (tavern→character etc.).
- All numbers animated via rAF-driven count-up hook (no re-render storms); lists (ladder 750 rows)
  virtualized (`@tanstack/react-virtual`).
- Save writes are O(changed slice) via structural sharing; full serialize ≤ 5 ms target at endgame saves.

## 11. Error handling & support (offline-first)

- Global error boundary → friendly "The tavern caught fire" screen with **Copy Debug Report** (app version,
  contentVersion, last 50 action log entries, save export) — user can file a GitHub issue manually.
- Action log ring-buffer (in save, capped) doubles as "recent adventures" UI feed.
- Dev console (`~` in dev builds / `?dev=1` on preview deploys, stripped from prod): grant resources,
  time-travel clock, force drops, jump story steps — mirrors sim policies for manual QA.

## 12. Deployment (Vercel)

- Static output (`vite build` → `dist/`), `vercel.json`: SPA fallback rewrite, `Cache-Control: immutable`
  for hashed assets, security headers (CSP: `default-src 'self'`; no external origins at runtime — fonts
  self-hosted via @fontsource).
- Preview deploys per PR (Vercel Git integration) — the de-facto review build for every milestone.
- PWA: precache shell + core sheets; backgrounds cached lazily; update prompt toast ("A new patch has
  arrived at the gates") driven by service-worker version bump.
- Release = git tag `v1.x.y` + CHANGELOG entry; contentVersion bumped in lockstep for patches.
