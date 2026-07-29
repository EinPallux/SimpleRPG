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
| **SFX (12 cues)** | ~~Kenney audio packs~~ → **synthesised at runtime** (`src/ui/audio.ts`, M8): no files, no download, no licence to track. See §4.1. | n/a — originally authored |
| **Music (3 loops: town, patrol/night, combat sting)** | **Not shipped at v1.0** — the documented fallback ("ship v1.0 SFX-only, add music in 1.0.x") is the one taken. Sourcing CC0 loops is a 1.0.x task. | CC0 only, when sourced |
| Fonts | Cinzel + Nunito Sans via @fontsource (self-hosted) | OFL |
| Extra backgrounds (town hub, arena backdrop, dungeon tints) | Derive from existing 15 via crops/tints/blur first; only source new low-poly art if it matches §2 | CC0 |
| Cosmetic frame variants | Generated from Kenney border SVGs (recolor/composite) — no sourcing needed | CC0 (derivative) |

Rule: **derive before download** — crops, tints, composites of existing CC0 assets keep the style tighter
than any new pack.

### 4.1 Audio: why there are no audio files

The plan was a Kenney CC0 sprite bundled by `audiosprite`. The packs were never brought into
`game_assets/`, and the honest options at M8 were (a) block the milestone on sourcing binaries, or (b) take
the fallback this table already allowed. We took (b) and went one step further: rather than *no* sound, the
twelve UI_DESIGN §7 cues are **synthesised with the Web Audio API** — a click is a 50 ms blip, a clang is a
filtered noise burst plus a metallic partial, the level-up is three rising notes.

What that buys: nothing to download (the audio adds ~4 kB of code, not ~400 kB of samples), nothing to
license or credit, it works offline on the very first paint, and every cue is original by construction so
there is no provenance question at all. What it costs: the cues are *synthetic*, not recorded — good enough
to punctuate an action, not a substitute for a sound designer.

If real audio is sourced later it replaces exactly one function (`playSfx`) and nothing else; the rest of
the game only knows cue names. Music is deliberately absent, so **Settings ships no music slider** — a dead
control is worse than an honest omission.

## 5. Pipeline (implemented as `scripts/optimize-assets.mjs`, ROADMAP M0)

`game_assets/` (pristine sources, git) → `public/assets/` (shipped, generated, git-ignored):
backgrounds → AVIF/WebP 1280w/1920w ≤200 KB · borders → tinted variant sheet + `nine-slice.css` ·
icons → SVG sprite (`currentColor`) · VFX → trimmed spritesheet + JSON atlas. **No audio stage** — the cues
are synthesised at runtime (§4.1), so there is nothing to pack. Manifest with content hashes for PWA
precache. `examples/` explicitly excluded.

## 6. CREDITS (rendered in Settings → Credits; keep in sync)

- "Fantasy UI Borders", "VFX Particles", audio packs — **Kenney** (kenney.nl), CC0. Thanks, Kenney.
- Icons — Lorc, Delapouite & contributors, **game-icons.net**, CC BY 3.0.
- Fonts — Cinzel (Natanael Gama), Nunito Sans — SIL OFL.
- Mission & patrol backgrounds — project-internal art supplied by the project owner.
- Everything else — original work for SimpleRPG.
