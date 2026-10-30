import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import { getSoundOptions } from './sound';

/**
 * Synthesized sound effects for modifier events. Built with Web Audio at
 * play time, so they cost no downloads. Each sound is a short recipe of
 * tones and filtered noise. Swap any recipe for a recorded file later.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

type Env = { at?: number; attack?: number; hold?: number; release: number; peak?: number };

/** A gain node shaped as attack, hold, then exponential release. */
function envelope(ac: AudioContext, out: AudioNode, { at = 0, attack = 0.005, hold = 0, release, peak = 1 }: Env) {
  const g = ac.createGain();
  const t = ac.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  g.connect(out);
  return { node: g, start: t, end: t + attack + hold + release };
}

function tone(
  ac: AudioContext,
  out: AudioNode,
  freq: number,
  env: Env,
  { type = 'sine' as OscillatorType, to, vibrato = 0 }: { type?: OscillatorType; to?: number; vibrato?: number } = {},
) {
  const e = envelope(ac, out, env);
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, e.start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, e.end);
  if (vibrato) {
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = vibrato;
    depth.gain.value = freq * 0.04;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(e.start);
    lfo.stop(e.end);
  }
  osc.connect(e.node);
  osc.start(e.start);
  osc.stop(e.end + 0.02);
}

function hiss(
  ac: AudioContext,
  out: AudioNode,
  env: Env,
  { type = 'bandpass' as BiquadFilterType, freq = 1000, to, q = 1 }: { type?: BiquadFilterType; freq?: number; to?: number; q?: number } = {},
) {
  const e = envelope(ac, out, env);
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, e.start);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, e.end);
  src.connect(filter).connect(e.node);
  src.start(e.start, Math.random());
  src.stop(e.end + 0.02);
}

const RECIPES = {
  /** Sizzle and a low thud as a piece burns. */
  lava(ac: AudioContext, out: AudioNode) {
    tone(ac, out, 90, { release: 0.35, peak: 0.45 }, { to: 40 });
    hiss(ac, out, { attack: 0.02, release: 0.7, peak: 0.3 }, { type: 'highpass', freq: 3000 });
    hiss(ac, out, { at: 0.05, release: 0.5, peak: 0.25 }, { freq: 800, to: 300, q: 2 });
  },
  /** Glassy crackle. */
  freeze(ac: AudioContext, out: AudioNode) {
    [2093, 2637, 3136, 4186].forEach((f, i) =>
      tone(ac, out, f, { at: i * 0.04, release: 0.5, peak: 0.12 }, { type: 'triangle' }));
    hiss(ac, out, { release: 0.15, peak: 0.3 }, { type: 'highpass', freq: 6000 });
  },
  /** Distant thunder. */
  storm(ac: AudioContext, out: AudioNode) {
    hiss(ac, out, { attack: 0.05, hold: 0.1, release: 1.4, peak: 0.9 }, { type: 'lowpass', freq: 400, to: 80 });
    hiss(ac, out, { release: 0.12, peak: 0.4 }, { type: 'highpass', freq: 2000 });
  },
  /** A heavy slash. */
  berserker(ac: AudioContext, out: AudioNode) {
    hiss(ac, out, { attack: 0.03, release: 0.18, peak: 0.6 }, { freq: 600, to: 3000, q: 3 });
    tone(ac, out, 110, { at: 0.12, release: 0.3, peak: 0.7 }, { type: 'sawtooth', to: 55 });
  },
  /** Cannon boom. */
  cannon(ac: AudioContext, out: AudioNode) {
    tone(ac, out, 150, { release: 0.6, peak: 0.5 }, { to: 35 });
    hiss(ac, out, { release: 0.9, peak: 0.4 }, { type: 'lowpass', freq: 1500, to: 100 });
  },
  /** Rising whoosh for a vent jump. */
  vent(ac: AudioContext, out: AudioNode) {
    hiss(ac, out, { attack: 0.15, release: 0.35, peak: 1 }, { freq: 300, to: 4000, q: 4 });
    tone(ac, out, 300, { attack: 0.1, release: 0.3, peak: 0.25 }, { to: 1200 });
  },
  /** Gerald coos. */
  gerald(ac: AudioContext, out: AudioNode) {
    tone(ac, out, 520, { attack: 0.04, hold: 0.08, release: 0.15, peak: 0.25 }, { to: 380, vibrato: 28 });
    tone(ac, out, 470, { at: 0.3, attack: 0.04, hold: 0.12, release: 0.2, peak: 0.25 }, { to: 340, vibrato: 28 });
  },
  /** Bright shimmer when an ability fires. */
  ability(ac: AudioContext, out: AudioNode) {
    [659, 880, 1175, 1568].forEach((f, i) =>
      tone(ac, out, f, { at: i * 0.05, release: 0.35, peak: 0.25 }, { type: 'triangle' }));
  },
  /** Falling minor stinger. */
  traitor(ac: AudioContext, out: AudioNode) {
    [440, 415, 330].forEach((f, i) =>
      tone(ac, out, f, { at: i * 0.12, release: 0.35, peak: 0.3 }, { type: 'sawtooth' }));
  },
  /** Low gong for YOU DIED. */
  gong(ac: AudioContext, out: AudioNode) {
    [65, 98, 131, 175].forEach((f, i) =>
      tone(ac, out, f * (1 + i * 0.003), { attack: 0.01, release: 2.2, peak: 0.35 / (i + 1) }));
  },
  /** Two-note warning for check. */
  check(ac: AudioContext, out: AudioNode) {
    tone(ac, out, 880, { release: 0.15, peak: 0.2 }, { type: 'square' });
    tone(ac, out, 698, { at: 0.12, release: 0.22, peak: 0.2 }, { type: 'square' });
  },
  /** Soft chime for any other modifier event. */
  chime(ac: AudioContext, out: AudioNode) {
    tone(ac, out, 784, { release: 0.5, peak: 0.3 });
    tone(ac, out, 1175, { at: 0.06, release: 0.5, peak: 0.15 });
  },
} satisfies Record<string, (ac: AudioContext, out: AudioNode) => void>;

export type SfxName = keyof typeof RECIPES;
/** Exposed so sounds can be rendered offline for previews. */
export const SYNTH_RECIPES: Readonly<typeof RECIPES> = RECIPES;
export const SFX_NAMES = Object.keys(RECIPES) as SfxName[];

export function playSynth(name: SfxName) {
  const { sfxEnabled, sfxVolume } = getSoundOptions();
  if (!sfxEnabled) return;
  const ac = audio();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = sfxVolume;
  master.connect(ac.destination);
  RECIPES[name](ac, master);
}

const EVENT_SOUNDS: Partial<Record<string, SfxName | null>> = {
  [MODIFIER_IDS.floorIsLava]: 'lava',
  [MODIFIER_IDS.winterIsComing]: 'freeze',
  [MODIFIER_IDS.stormClosesIn]: 'storm',
  [MODIFIER_IDS.berserker]: 'berserker',
  [MODIFIER_IDS.forTheEmperor]: 'cannon',
  [MODIFIER_IDS.ventTiles]: 'vent',
  [MODIFIER_IDS.gerald]: 'gerald',
  [MODIFIER_IDS.traitor]: 'traitor',
  [MODIFIER_IDS.youDied]: 'gong',
  [MODIFIER_IDS.noFlyZone]: 'ability',
  [MODIFIER_IDS.quietQuitting]: 'ability',
  [MODIFIER_IDS.theSnap]: 'ability',
  [MODIFIER_IDS.bankedEnPassant]: 'ability',
  // Reginald reviews every move. A sound each time would wear thin.
  [MODIFIER_IDS.reginaldBeak]: null,
};

/** The sound for a modifier event, or null for a silent one. */
export function getEventSound(modifierId: string): SfxName | null {
  const sound = EVENT_SOUNDS[modifierId];
  return sound === undefined ? 'chime' : sound;
}

/** Sounds for events that just happened: one per kind, at most two. */
export function pickEventSounds(events: { modifierId: string }[]): SfxName[] {
  const picked: SfxName[] = [];
  for (const event of events) {
    const sound = getEventSound(event.modifierId);
    if (sound && !picked.includes(sound)) picked.push(sound);
  }
  return picked.slice(0, 2);
}
