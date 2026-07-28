# AGENTS.md — Working on SimpleRPG (humans & AI agents)

This file is the workflow companion to **CLAUDE.md** (project invariants — read it first; its rules are
canonical for any agent, Claude or otherwise). The design suite listed there is the specification; the job
of every session is to turn ROADMAP.md milestones into playable vertical slices **without drifting from
the docs**.

## Ground rules

1. **Spec-first:** if the docs answer it, do what they say. If they don't, decide using CLAUDE.md's
   tie-breakers and write the decision back into the right doc in the same PR. Never leave decisions only
   in commit messages or chat.
2. **Docs and code move together:** constants ↔ BALANCING.md · content ↔ CONTENT_CATALOG.md · screens ↔
   UI_DESIGN.md · scope ↔ ROADMAP.md checkboxes.
3. **Small verifiable slices:** each PR ends green (typecheck, lint, unit, content validation, sim
   scenarios, build) and deployable to preview. No long-lived branches.
4. **Never bypass the frame system, the rng streams, the i18n layer, or the engine-purity boundary** —
   these are the four places quick hacks rot the codebase.

## Suggested specialist split (for multi-agent work)

| Role | Owns | Verifies with |
|---|---|---|
| **Engine agent** | `src/engine/`, `src/sim/` | Vitest + sim scenarios |
| **UI agent** | `src/ui/`, styles, screens | Testing Library, Playwright, axe, 375px pass |
| **Content agent** | `src/content/`, `src/i18n/en.json`, flavor writing (Writing Guide §13) | `pnpm validate:content` |
| **Balance agent** | constants tuning, BALANCING §10 changelog | full sim matrix incl. nightly 180-day |
| **Asset agent** | `scripts/optimize-assets.mjs`, sourcing per ASSETS.md | license table complete, pipeline output budgets |

Interfaces between roles are the typed engine APIs and content schemas — negotiate there, not in UI code.
Parallel-safe seams: content files, individual screens, individual engine modules. Serialize anything
touching the save schema or `constants.ts`.

## PR checklist (copy into every PR description)

- [ ] Scope maps to a ROADMAP milestone item (named in title)
- [ ] Engine changes: unit tests added/updated; no `Math.random`/`Date.now` in logic
- [ ] Constants touched → BALANCING.md §10 row + sim scenarios green (or bounds deliberately updated here)
- [ ] Content touched → `pnpm validate:content` green; i18n keys added; catalog doc updated
- [ ] UI touched → empty/locked/loading states, keyboard nav, reduced-motion, 375 px screenshot
- [ ] Save schema touched → migration + fixture test
- [ ] New assets → license verified + ASSETS.md row + credits screen entry
- [ ] Docs updated where behavior/scope/numbers changed

## Verification quick-reference

`pnpm test` (unit+content) · `pnpm sim -- --profile optimal --days 30` (pacing) · `pnpm build && pnpm
preview` (smoke) · Playwright suite for flows · Lighthouse budget on preview deploy. The anti-rush bounds
(BALANCING §8.2) are release-blocking, always.
