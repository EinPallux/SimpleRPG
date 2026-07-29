/**
 * Sound (UI_DESIGN.md §7 audio map, ASSETS.md §5).
 *
 * DEVIATION FROM TECHNICAL_ARCHITECTURE.md §1, recorded deliberately: the stack
 * table names howler.js driving an `audiosprite` bundle of Kenney CC0 cues. No
 * such audio exists in `game_assets/` — the repo ships UI borders and VFX only —
 * and ASSETS.md §4 already sanctions the fallback ("ship v1.0 SFX-only"). So the
 * cues below are **synthesised** with the Web Audio API instead of streamed from
 * a sprite: zero bytes to download, zero licences to track, works offline on the
 * first paint, and every cue is originally authored by construction.
 *
 * The seam is `playSfx(cue)`. Swapping in a sprite backend later means
 * reimplementing this one function; nothing that makes noise imports anything
 * else. Music is deliberately absent at v1.0 — the same ASSETS.md fallback —
 * so there is no music channel to slide.
 *
 * Everything is lazy and user-gesture safe: the AudioContext is not created
 * until the first cue, which by definition follows a click.
 */
import { loadPrefs, type Prefs } from '@/persist/prefs';

export type SfxCue =
  | 'ui_click'
  | 'ui_deny'
  | 'coin_burst'
  | 'chest_open'
  | 'rarity_rare'
  | 'rarity_epic'
  | 'rarity_legendary'
  | 'crit_hit'
  | 'block_clang'
  | 'levelup_fanfare'
  | 'wheel_tick'
  | 'well_splash';

export const SFX_CUES: readonly SfxCue[] = [
  'ui_click',
  'ui_deny',
  'coin_burst',
  'chest_open',
  'rarity_rare',
  'rarity_epic',
  'rarity_legendary',
  'crit_hit',
  'block_clang',
  'levelup_fanfare',
  'wheel_tick',
  'well_splash',
];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let prefs: Prefs = DEFAULT_AT_MODULE_LOAD();

function DEFAULT_AT_MODULE_LOAD(): Prefs {
  // Module load happens before React mounts; reading here keeps the very first
  // click at the right volume instead of a frame of full-blast default.
  return loadPrefs();
}

/** The settings modal calls this on every slider move. */
export function setAudioPrefs(next: Prefs): void {
  prefs = next;
  if (master && ctx) {
    master.gain.setTargetAtTime(effectiveVolume(), ctx.currentTime, 0.01);
  }
}

function effectiveVolume(): number {
  return prefs.muted ? 0 : prefs.volMaster * prefs.volSfx;
}

/** Lazily build the graph. Returns null where Web Audio is unavailable. */
function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (ctx && master) return { ctx, master };
  const Ctor: typeof AudioContext | undefined =
    globalThis.AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = effectiveVolume();
    master.connect(ctx.destination);
    return { ctx, master };
  } catch {
    ctx = null;
    master = null;
    return null;
  }
}

interface ToneSpec {
  /** waveform; 'noise' synthesises a short buffer of white noise instead */
  type: OscillatorType | 'noise';
  /** start frequency in Hz (ignored for noise) */
  freq: number;
  /** optional glide target */
  to?: number;
  /** seconds */
  dur: number;
  /** peak gain 0..1 before the master */
  gain: number;
  /** seconds to wait before firing — how chords and arpeggios are written */
  delay?: number;
  /** lowpass corner for noise bursts, Hz */
  filter?: number;
}

/**
 * The cue dictionary. Each entry is a tiny additive sketch rather than a
 * sample: a click is a blip, a clang is a filtered noise burst plus a metallic
 * partial, a fanfare is three rising notes. Kept short (≤ 700 ms) because these
 * fire constantly and a long tail is what makes game audio exhausting.
 */
const CUES: Record<SfxCue, ToneSpec[]> = {
  ui_click: [{ type: 'square', freq: 660, to: 880, dur: 0.05, gain: 0.12 }],
  ui_deny: [{ type: 'square', freq: 220, to: 150, dur: 0.14, gain: 0.14 }],
  coin_burst: [
    { type: 'triangle', freq: 1180, dur: 0.07, gain: 0.14 },
    { type: 'triangle', freq: 1560, dur: 0.09, gain: 0.12, delay: 0.05 },
    { type: 'triangle', freq: 1980, dur: 0.11, gain: 0.09, delay: 0.1 },
  ],
  chest_open: [
    { type: 'noise', freq: 0, dur: 0.16, gain: 0.1, filter: 2600 },
    { type: 'sine', freq: 300, to: 620, dur: 0.28, gain: 0.14, delay: 0.06 },
  ],
  rarity_rare: [{ type: 'sine', freq: 520, to: 780, dur: 0.3, gain: 0.14 }],
  rarity_epic: [
    { type: 'sine', freq: 520, to: 880, dur: 0.34, gain: 0.14 },
    { type: 'sine', freq: 660, dur: 0.3, gain: 0.09, delay: 0.08 },
  ],
  rarity_legendary: [
    { type: 'sawtooth', freq: 440, to: 880, dur: 0.42, gain: 0.11 },
    { type: 'sine', freq: 1320, dur: 0.36, gain: 0.09, delay: 0.1 },
    { type: 'sine', freq: 1760, dur: 0.4, gain: 0.07, delay: 0.2 },
  ],
  crit_hit: [
    { type: 'noise', freq: 0, dur: 0.09, gain: 0.16, filter: 5200 },
    { type: 'square', freq: 880, to: 420, dur: 0.12, gain: 0.1 },
  ],
  block_clang: [
    { type: 'noise', freq: 0, dur: 0.12, gain: 0.12, filter: 3400 },
    { type: 'triangle', freq: 1240, to: 980, dur: 0.2, gain: 0.1 },
  ],
  levelup_fanfare: [
    { type: 'triangle', freq: 523, dur: 0.16, gain: 0.14 },
    { type: 'triangle', freq: 659, dur: 0.16, gain: 0.14, delay: 0.13 },
    { type: 'triangle', freq: 784, dur: 0.34, gain: 0.15, delay: 0.26 },
    { type: 'sine', freq: 1046, dur: 0.36, gain: 0.1, delay: 0.32 },
  ],
  wheel_tick: [{ type: 'square', freq: 1400, dur: 0.03, gain: 0.08 }],
  well_splash: [
    { type: 'noise', freq: 0, dur: 0.22, gain: 0.1, filter: 1400 },
    { type: 'sine', freq: 420, to: 180, dur: 0.3, gain: 0.1, delay: 0.02 },
  ],
};

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const frames = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic LCG rather than Math.random(): invariant 3 is an engine rule,
  // but a reproducible click is also just easier to reason about in tests.
  let seed = 0x2f6e2b1;
  for (let i = 0; i < frames; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x3fffffff - 1) * 0.6;
  }
  return buffer;
}

function fire(context: AudioContext, out: GainNode, spec: ToneSpec): void {
  const at = context.currentTime + (spec.delay ?? 0);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(spec.gain, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + spec.dur);
  gain.connect(out);

  if (spec.type === 'noise') {
    const src = context.createBufferSource();
    src.buffer = noiseBuffer(context, spec.dur);
    if (spec.filter) {
      const lp = context.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = spec.filter;
      src.connect(lp).connect(gain);
    } else {
      src.connect(gain);
    }
    src.start(at);
    src.stop(at + spec.dur);
    return;
  }

  const osc = context.createOscillator();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, at);
  if (spec.to !== undefined) osc.frequency.exponentialRampToValueAtTime(spec.to, at + spec.dur);
  osc.connect(gain);
  osc.start(at);
  osc.stop(at + spec.dur);
}

/**
 * Play a cue. Silent and harmless when muted, when Web Audio is missing (SSR,
 * jsdom, a locked-down browser), or when the context refuses to resume — a
 * sound effect is never allowed to throw into a click handler.
 */
export function playSfx(cue: SfxCue): void {
  if (effectiveVolume() <= 0) return;
  const graph = audio();
  if (!graph) return;
  try {
    if (graph.ctx.state === 'suspended') void graph.ctx.resume();
    for (const spec of CUES[cue]) fire(graph.ctx, graph.master, spec);
  } catch {
    // Never let audio break an interaction.
  }
}

/** Test seam: drop the graph so the next cue rebuilds it. */
export function resetAudioForTests(): void {
  try {
    void ctx?.close();
  } catch {
    // already closed
  }
  ctx = null;
  master = null;
  prefs = loadPrefs();
}
