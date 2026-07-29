/**
 * jsdom has no Web Audio, which is itself the first thing worth testing: the
 * cues must be silent and harmless there rather than throwing into a click
 * handler. Everything past that runs against a recording stand-in for
 * AudioContext — enough to prove the gain wiring and that every cue actually
 * synthesises something, without pretending to test how it sounds.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '@/persist/prefs';
import { playSfx, resetAudioForTests, setAudioPrefs, SFX_CUES, type SfxCue } from './audio';

class FakeParam {
  value = 0;
  /** every setTargetAtTime target, in order — how volume changes are observed */
  targets: number[] = [];
  setValueAtTime() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  setTargetAtTime(value: number) {
    this.targets.push(value);
    return this;
  }
}

class FakeNode {
  connect<T>(next: T): T {
    return next;
  }
  disconnect() {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeSource extends FakeNode {
  type = '';
  buffer: unknown = null;
  frequency = new FakeParam();
  start() {}
  stop() {}
}

class FakeAudioContext {
  static built = 0;
  static last: FakeAudioContext | null = null;
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'suspended';
  destination = new FakeNode();
  /** the first gain built is the master — see audio.ts `audio()` */
  master: FakeGain | null = null;
  /** oscillators + buffer sources started for the cues played so far */
  sources = 0;
  resumed = 0;

  constructor() {
    FakeAudioContext.built += 1;
    FakeAudioContext.last = this;
  }
  createGain() {
    const gain = new FakeGain();
    this.master ??= gain;
    return gain;
  }
  createOscillator() {
    this.sources += 1;
    return new FakeSource();
  }
  createBufferSource() {
    this.sources += 1;
    return new FakeSource();
  }
  createBiquadFilter() {
    return new FakeSource();
  }
  createBuffer(_channels: number, frames: number) {
    const data = new Float32Array(frames);
    return { getChannelData: () => data };
  }
  resume() {
    this.resumed += 1;
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

type Global = typeof globalThis & { AudioContext?: typeof AudioContext };

function installFakeAudio() {
  FakeAudioContext.built = 0;
  FakeAudioContext.last = null;
  (globalThis as Global).AudioContext = FakeAudioContext as unknown as typeof AudioContext;
  resetAudioForTests();
}

function context(): FakeAudioContext {
  const ctx = FakeAudioContext.last;
  if (!ctx) throw new Error('no AudioContext was built');
  return ctx;
}

beforeEach(() => {
  delete (globalThis as Global).AudioContext;
  resetAudioForTests();
});

afterEach(() => {
  delete (globalThis as Global).AudioContext;
  resetAudioForTests();
});

describe('audio', () => {
  it('is silent and harmless where Web Audio does not exist', () => {
    for (const cue of SFX_CUES) expect(() => playSfx(cue)).not.toThrow();
  });

  it('survives an AudioContext that refuses to be constructed', () => {
    (globalThis as Global).AudioContext = class {
      constructor() {
        throw new Error('blocked by policy');
      }
    } as unknown as typeof AudioContext;
    resetAudioForTests();
    expect(() => playSfx('ui_click')).not.toThrow();
  });

  it('synthesises at least one voice for every cue in the union', () => {
    installFakeAudio();
    for (const cue of SFX_CUES) {
      const before = FakeAudioContext.last?.sources ?? 0;
      playSfx(cue);
      expect(context().sources, `${cue} produced no sound`).toBeGreaterThan(before);
    }
  });

  it('resumes a context the browser parked before playing', () => {
    installFakeAudio();
    playSfx('ui_click');
    expect(context().resumed).toBe(1);
  });

  it('lists exactly the cues the SfxCue union declares', () => {
    // Exhaustive by construction: adding a cue to the union fails to compile
    // here until it is listed, which is the point of the check.
    const every: Record<SfxCue, true> = {
      ui_click: true,
      ui_deny: true,
      coin_burst: true,
      chest_open: true,
      rarity_rare: true,
      rarity_epic: true,
      rarity_legendary: true,
      crit_hit: true,
      block_clang: true,
      levelup_fanfare: true,
      wheel_tick: true,
      well_splash: true,
    };
    expect([...SFX_CUES].sort()).toEqual(Object.keys(every).sort());
  });

  it('does nothing at all when muted', () => {
    installFakeAudio();
    setAudioPrefs({ ...DEFAULT_PREFS, muted: true });
    for (const cue of SFX_CUES) playSfx(cue);
    // Not even a context: a muted game should not open an audio device.
    expect(FakeAudioContext.built).toBe(0);
  });

  it('does nothing at all at zero volume, on either fader', () => {
    installFakeAudio();
    setAudioPrefs({ ...DEFAULT_PREFS, volMaster: 0 });
    playSfx('coin_burst');
    setAudioPrefs({ ...DEFAULT_PREFS, volSfx: 0 });
    playSfx('coin_burst');
    expect(FakeAudioContext.built).toBe(0);
  });

  it('opens the graph at the current effective volume', () => {
    installFakeAudio();
    setAudioPrefs({ ...DEFAULT_PREFS, volMaster: 0.5, volSfx: 0.5 });
    playSfx('ui_click');
    expect(context().master?.gain.value).toBeCloseTo(0.25);
  });

  it('retunes a live graph as the sliders move', () => {
    installFakeAudio();
    playSfx('ui_click');
    const master = context().master;
    setAudioPrefs({ ...DEFAULT_PREFS, volMaster: 1, volSfx: 0.5 });
    setAudioPrefs({ ...DEFAULT_PREFS, muted: true });
    expect(master?.gain.targets).toEqual([0.5, 0]);
  });
});
