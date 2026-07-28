# CLAUDE.md — SimpleRPG Project Guide

SimpleRPG is a **fully single-player** fantasy browser RPG (Shakes-&-Fidget-inspired, zero multiplayer,
zero monetization) that *simulates* an MMO with deterministic bots. 100% client-side, static deploy on
Vercel. Currently in **planning-complete** state; build phases in ROADMAP.md.

## Read before working (docs are the spec — follow them, don't re-invent)

| Question | Doc (canonical) |
|---|---|
| How does a system behave? | **GAME_DESIGN.md** |
| What are the exact numbers/formulas/pacing bounds? | **BALANCING.md** (wins over all other docs on numbers) |
| What content exists (zones, sets, bosses, quests…)? | **CONTENT_CATALOG.md** |
| Stack, folders, save/time/RNG, quality gates? | **TECHNICAL_ARCHITECTURE.md** |
| Look, components, screens? | **UI_DESIGN.md** |
| Asset rules & licenses? | **ASSETS.md** |
| What to build next / scope? | **ROADMAP.md** |
| Team/agent workflow & PR checklist? | **AGENTS.md** |

Precedence on conflict: BALANCING (numbers) → GAME_DESIGN (rules) → CONTENT_CATALOG (content) → the rest.
If you find a genuine contradiction: fix **both** docs in the same commit and note it in the commit message.

## Invariants (do not violate; do not "improve" away)

1. **No backend, no accounts, no telemetry, no real-money anything, no ads.** All state local (IndexedDB).
2. **No multiplayer** — bots must *look* like players but everything is offline & deterministic.
3. Randomness only via the seeded, persisted streams in `src/engine/rng.ts` — never `Math.random()`.
4. Engine purity: `src/engine/` has no React/DOM/`Date.now()` inside logic (clock is injected).
5. Every constant lives in `src/engine/constants.ts` mirroring BALANCING.md names. Changing one requires:
   sim scenarios green (or bounds changed deliberately in the same PR) + a row in BALANCING.md §10.
6. The **anti-rush contract** (BALANCING.md §8.2) is a product requirement, not a test detail.
7. Assets: CC0/CC-BY only, credited (ASSETS.md); `game_assets/examples/` is reference-only and must never
   ship; never copy Shakes & Fidget / SimpleMMO art, names or text.
8. All user-facing strings go through i18n keys (English-only content, i18n-ready structure).
9. Saves migrate forward, never wipe. Every save-schema change ships a migration + fixture test.
10. UI chrome is built from the Kenney Fantasy UI Borders frame system (UI_DESIGN.md §3) — no ad-hoc
    borders/panels.

## Working style

- Follow ROADMAP milestones in order; keep each PR a playable vertical slice; update ROADMAP checkboxes
  and (when relevant) BALANCING §10 in the same PR.
- Definition of done for any feature: engine functions unit-tested · content zod-validated · screen has
  empty/locked/loading states · a11y (keyboard + labels) · sim scenarios green · works at 375 px · preview
  deploy verified.
- Commands (once scaffolded, M0): `pnpm dev` · `pnpm test` · `pnpm sim -- --profile optimal --days 30` ·
  `pnpm validate:content` · `pnpm build`.
- Tone of all game copy: warm, dry humor, PG, original (CONTENT_CATALOG §13 writing guide).
- When a design question isn't answered by the docs: prefer the Shakes-&-Fidget-like option, the more
  respectful-of-player-time option, and the simpler-deterministic option — in that order. Document the
  decision in the appropriate doc in the same PR.
