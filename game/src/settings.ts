import { setSoundOptions } from './sound';

export interface AppSettings {
  // Audio
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  bgmVolume: number; // 0–100
  sfxVolume: number; // 0–100
  // Gameplay
  showLegalMoves: boolean;
  autoQueen: boolean;
  confirmResign: boolean;
  showCoordinates: boolean;
  // Accessibility / Display
  highContrast: boolean;
}

const DEFAULTS: AppSettings = {
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 35,
  sfxVolume: 80,
  showLegalMoves: true,
  autoQueen: false,
  confirmResign: true,
  showCoordinates: true,
  highContrast: false,
};

const KEY = 'pg2-settings';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
  // Sync sound module immediately
  setSoundOptions({
    bgmEnabled: s.bgmEnabled,
    sfxEnabled: s.sfxEnabled,
    bgmVolume: s.bgmVolume / 100,
    sfxVolume: s.sfxVolume / 100,
  });
  // Sync high-contrast CSS class on body
  document.body.classList.toggle('high-contrast', s.highContrast);
}

/** Apply settings at startup (sync sound + CSS without a save event). */
export function applySettings(s: AppSettings): void {
  saveSettings(s);
}
