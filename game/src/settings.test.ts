import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./sound', () => ({ setSoundOptions: () => {} }));

function stubBrowser(deviceCalm: boolean) {
  const classes = new Set<string>();
  const classList = {
    toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
    contains: (name: string) => classes.has(name),
  };
  vi.stubGlobal('document', { body: { classList } });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: deviceCalm }) });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
}

describe('Reduce Motion setting', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is off by default and follows the device', async () => {
    const { loadSettings, applySettings, prefersCalm } = await import('./settings');
    stubBrowser(false);
    const s = loadSettings();
    expect(s.reduceMotion).toBe(false);
    applySettings(s);
    expect(prefersCalm()).toBe(false);
    stubBrowser(true);
    expect(prefersCalm()).toBe(true);
  });

  it('turns motion off when the player asks, even if the device does not', async () => {
    const { loadSettings, saveSettings, prefersCalm } = await import('./settings');
    stubBrowser(false);
    saveSettings({ ...loadSettings(), reduceMotion: true });
    expect(document.body.classList.contains('reduce-motion')).toBe(true);
    expect(prefersCalm()).toBe(true);
    saveSettings({ ...loadSettings(), reduceMotion: false });
    expect(prefersCalm()).toBe(false);
  });
});
