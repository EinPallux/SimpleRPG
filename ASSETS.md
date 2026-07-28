# SimpleRPG — Asset Inventory, Art Direction & Sourcing Plan

> Canonical for what assets exist, what must be sourced, and the licensing rules. UI usage: UI_DESIGN.md.
> Build pipeline: TECHNICAL_ARCHITECTURE.md §10.

---

## 1. License policy (hard rules)

- Allowed: **CC0 / public domain** (preferred) and **CC BY** (attribution honored in-game + CREDITS.md).
- Forbidden: CC BY-SA / NC / ND, GPL-art, "free for personal use", AI packs with unclear provenance,
  anything ripped from commercial games. **Never** imitate Shakes & Fidget / SimpleMMO artwork or names.
- Every imported pack gets a folder-level `License.txt` (keep the original) + a row in §6 and in the
  in-game credits screen. `scripts/validate-content.mjs` fails CI if an asset folder lacks a license row.

## 2. Art direction (owner-approved)

**"Clean modern fantasy":** flat/vector iconography, low-poly painted environments, dark navy UI with
tinted line-art frames, warm gold accents. Cohesion rules:
- Icons: single visual family (game-icons.net), flat fills, 2-tone max + tint; no gradients inside icons.
- Environments: the existing low-poly background set defines saturation/lighting targets; new art must match
  (bright skies, faceted forms, warm palette).
- No photorealism, no pixel art, no hand-drawn comic mixing. Characters/NPCs are stylized busts or emblem
  compositions — we deliberately avoid full character illustration (uneven CC0 supply) in favor of
  **procedural emblem portraits** (icon × palette × frame) for hero and bots: infinitely extensible, always
  on-style.

## 3. Already in the repository (source of truth: `game_assets/`)

| Path | Contents | License | Role |
|---|---|---|---|
| `UI/Kenney_FantasyUIBorders/` | 32 border designs × (Panel / Border / Transparent center / Transparent border) × Default & Double families, 48×48 PNG + SVG source, dividers | CC0 (License.txt present) | The entire UI chrome (UI_DESIGN.md §3) |
| `UI/Backgrounds/` | 14 low-poly mission scenes (1672×941) + `patrol_background.png` | uploaded by owner (treat as project-internal; confirm provenance before any store release) | zone art (CONTENT_CATALOG.md §3), expedition locales, patrol screen |
| `VFX/Kenney_VFXParticles/` | ~80 particle sprites (flames, sparks, stars, smoke, magic, slashes) | CC0 (License.txt present) | combat/reward juice (UI_DESIGN.md §7) |
| `examples/` | 6 Shakes & Fidget reference screenshots | **reference only — must never ship** (exclude from build output) | vibe reference |

## 4. To source during build (all verified-safe candidates)

| Need | Plan | License |
|---|---|---|
| **Item/monster/system icons (~400 at v1.0)** | game-icons.net curated subset (weapons, armor, creatures, potions, UI glyphs), recolored to family | CC BY 3.0 → credit "Lorc, Delapouite & contributors, game-icons.net" |
| Currency/emblem glyph accents | Kenney "Board Game Icons" + "Game Icons" packs as fallback family | CC0 |
| **SFX (~25 cues)** | Kenney "Interface Sounds", "RPG Audio", "Impact Sounds", "Casino Audio" (wheel) | CC0 |
| **Music (3 loops: town, patrol/night, combat sting)** | OpenGameArt CC0 medieval/ambient loops (shortlist & verify at build; fallback: ship v1.0 SFX-only, add music in 1.0.x) | CC0 only |
| Fonts | Cinzel + Nunito Sans via @fontsource (self-hosted) | OFL |
| Extra backgrounds (town hub, arena backdrop, dungeon tints) | Derive from existing 15 via crops/tints/blur first; only source new low-poly art if it matches §2 | CC0 |
| Cosmetic frame variants | Generated from Kenney border SVGs (recolor/composite) — no sourcing needed | CC0 (derivative) |

Rule: **derive before download** — crops, tints, composites of existing CC0 assets keep the style tighter
than any new pack.

## 5. Pipeline (implemented as `scripts/optimize-assets.mjs`, ROADMAP M0)

`game_assets/` (pristine sources, git) → `public/assets/` (shipped, generated, git-ignored):
backgrounds → AVIF/WebP 1280w/1920w ≤200 KB · borders → tinted variant sheet + `nine-slice.css` ·
icons → SVG sprite (`currentColor`) · VFX → trimmed spritesheet + JSON atlas · audio → sprite via
audiosprite. Manifest with content hashes for PWA precache. `examples/` explicitly excluded.

## 6. CREDITS (rendered in Settings → Credits; keep in sync)

- "Fantasy UI Borders", "VFX Particles", audio packs — **Kenney** (kenney.nl), CC0. Thanks, Kenney.
- Icons — Lorc, Delapouite & contributors, **game-icons.net**, CC BY 3.0.
- Fonts — Cinzel (Natanael Gama), Nunito Sans — SIL OFL.
- Mission & patrol backgrounds — project-internal art supplied by the project owner.
- Everything else — original work for SimpleRPG.
