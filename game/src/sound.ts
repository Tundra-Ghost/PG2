/**
 * Sound manager for Pigeon Chess.
 * All audio is loaded lazily on first use — no autoplay until the user interacts.
 * BGM respects browser autoplay policy by deferring to the first user gesture.
 */

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
  // Clone so overlapping hits don't cut each other off
  const clone = src.cloneNode() as HTMLAudioElement;
  clone.volume = opts.sfxVolume;
  clone.play().catch(() => { /* swallow autoplay errors */ });
}

// ── BGM ────────────────────────────────────────────────────────────────────

let bgmEl: HTMLAudioElement | null = null;
let currentBgmPath: string | null = null;
// Queue a BGM path before the first gesture unlocks autoplay
let pendingBgm: string | null = null;

function applyBgmSettings() {
  if (!bgmEl) return;
  bgmEl.volume = opts.bgmVolume;
  bgmEl.loop = true;
}

function startBgm(path: string) {
  if (!opts.bgmEnabled) return;
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
    // Autoplay blocked — store as pending, play on next user gesture
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
 * Call once on the first user interaction (click/keydown) to unblock BGM.
 * App.tsx attaches this to the root div's onClick.
 */
export function unlockBgm() {
  if (!pendingBgm) return;
  startBgm(pendingBgm);
  pendingBgm = null;
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
export function playMove()    { playSfx('/sounds/move.mp3'); }
export function playCapture() { playSfx('/sounds/capture.mp3'); }
export function playCastle()  { playSfx('/sounds/castle.mp3'); }
export function playClick()   { playSfx('/sounds/button-click.mp3'); }

// BGM
export function playMenuBgm() { startBgm('/sounds/bgm-menu.mp3'); }
export function playGameBgm() { startBgm('/sounds/bgm-game.mp3'); }
export { stopBgm };
