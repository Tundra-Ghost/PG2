import buttonClickSrc from './Button Click.mp3';
import captureSrc from './capture.mp3';
import castleSrc from './castle.mp3';
import moveSelfSrc from './move-self.mp3';

/**
 * Sound manager for Pigeon Chess.
 * All audio is loaded lazily on first use — no autoplay until the user interacts.
 * BGM respects browser autoplay policy by deferring to the first user gesture.
 */

// BASE_URL is '/' in dev, './' in production (matches vite.config base: './')
// This ensures audio paths work whether served from root or a subdirectory.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // strip trailing slash
function soundPath(file: string): string {
  return `${BASE}/sounds/${file}`;
}

type SoundOptions = {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  sfxVolume: number; // 0–1
  bgmVolume: number; // 0–1
};

let opts: SoundOptions = {
  sfxEnabled: true,
  bgmEnabled: true,
  sfxVolume: 0.8,
  bgmVolume: 0.35,
};

// ── SFX cache ──────────────────────────────────────────────────────────────

const sfxCache = new Map<string, HTMLAudioElement>();

function getSfx(path: string): HTMLAudioElement {
  if (!sfxCache.has(path)) {
    const el = new Audio(path);
    el.preload = 'auto';
    sfxCache.set(path, el);
  }
  return sfxCache.get(path)!;
}

function playSfx(path: string) {
  if (!opts.sfxEnabled) return;
  const src = getSfx(path);
  // Use new Audio(src) rather than cloneNode — more reliable cross-browser
  const clone = new Audio(src.src);
  clone.volume = opts.sfxVolume;
  clone.play().catch(() => { /* swallow — user hasn't interacted yet */ });
}

// ── BGM ────────────────────────────────────────────────────────────────────

let bgmEl: HTMLAudioElement | null = null;
let currentBgmPath: string | null = null;
let pendingBgm: string | null = null;

function applyBgmSettings() {
  if (!bgmEl) return;
  bgmEl.volume = opts.bgmVolume;
  bgmEl.loop = true;
}

function startBgm(path: string) {
  if (!opts.bgmEnabled) return;
  // Already playing this track — nothing to do
  if (currentBgmPath === path && bgmEl && !bgmEl.paused) return;

  if (bgmEl) {
    bgmEl.pause();
    bgmEl.currentTime = 0;
  }

  bgmEl = new Audio(path);
  bgmEl.loop = true;
  bgmEl.volume = opts.bgmVolume;
  currentBgmPath = path;

  bgmEl.play().catch(() => {
    // Browser blocked autoplay — queue for first user gesture
    pendingBgm = path;
  });
}

function stopBgm() {
  if (bgmEl) {
    bgmEl.pause();
    bgmEl.currentTime = 0;
    bgmEl = null;
    currentBgmPath = null;
  }
  pendingBgm = null;
}

/**
 * Call once on the first user interaction to unblock BGM.
 * App.tsx attaches this to every screen's root onClick.
 */
export function unlockBgm() {
  if (!pendingBgm) return;
  const path = pendingBgm;
  pendingBgm = null;
  startBgm(path);
}

// ── Public API ─────────────────────────────────────────────────────────────

export function setSoundOptions(partial: Partial<SoundOptions>) {
  opts = { ...opts, ...partial };
  applyBgmSettings();
  if (!opts.bgmEnabled) stopBgm();
}

export function getSoundOptions(): Readonly<SoundOptions> {
  return opts;
}

// SFX
export function playMove()    { playSfx(moveSelfSrc); }
export function playCapture() { playSfx(captureSrc); }
export function playCastle()  { playSfx(castleSrc); }
export function playClick()   { playSfx(buttonClickSrc); }

// BGM
export function playMenuBgm() { startBgm(soundPath('bgm-menu.mp3')); }
export function playGameBgm() { startBgm(soundPath('bgm-game.mp3')); }
export { stopBgm };
