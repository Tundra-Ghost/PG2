import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny stand-in for the browser: a document and window that can fire events,
// and an Audio element that records play and pause.
class FakeAudio {
  paused = true;
  loop = false;
  volume = 1;
  currentTime = 0;
  constructor(public src: string) {
    audios.push(this);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

let audios: FakeAudio[] = [];
let visibility: 'visible' | 'hidden' = 'visible';

function fakeTarget() {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    addEventListener: (type: string, fn: () => void) => {
      (handlers[type] ??= []).push(fn);
    },
    fire: (type: string) => (handlers[type] ?? []).forEach(fn => fn()),
  };
}

let doc: ReturnType<typeof fakeTarget>;
let win: ReturnType<typeof fakeTarget>;

async function loadSound() {
  vi.resetModules();
  return import('./sound');
}

function hide() {
  visibility = 'hidden';
  doc.fire('visibilitychange');
}

function show() {
  visibility = 'visible';
  doc.fire('visibilitychange');
}

const music = () => audios.filter(a => a.loop);

beforeEach(() => {
  audios = [];
  visibility = 'visible';
  doc = fakeTarget();
  win = fakeTarget();
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('document', {
    ...doc,
    get visibilityState() {
      return visibility;
    },
  });
  vi.stubGlobal('window', win);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('music when the player leaves the page', () => {
  it('pauses when the page is hidden and resumes when it comes back', async () => {
    const sound = await loadSound();
    sound.playMenuBgm();
    expect(music()[0].paused).toBe(false);

    hide();
    expect(music()[0].paused).toBe(true);

    show();
    expect(music()[0].paused).toBe(false);
  });

  it('pauses on pagehide and resumes on pageshow', async () => {
    const sound = await loadSound();
    sound.playMenuBgm();

    win.fire('pagehide');
    expect(music()[0].paused).toBe(true);

    win.fire('pageshow');
    expect(music()[0].paused).toBe(false);
  });

  it('stays off if music is turned off while the page is hidden', async () => {
    const sound = await loadSound();
    sound.playMenuBgm();
    hide();
    sound.setSoundOptions({ bgmEnabled: false });

    show();
    expect(music().every(a => a.paused)).toBe(true);
  });

  it('does not resume music that was already stopped', async () => {
    const sound = await loadSound();
    sound.playMenuBgm();
    sound.stopBgm();

    hide();
    show();
    expect(music().every(a => a.paused)).toBe(true);
  });

  it('waits for the player to come back before starting a new track', async () => {
    const sound = await loadSound();
    sound.playMenuBgm();
    hide();
    sound.playGameBgm();

    const game = music().find(a => a.src.endsWith('bgm-game.mp3'))!;
    expect(game.paused).toBe(true);

    show();
    expect(game.paused).toBe(false);
    expect(music().filter(a => !a.paused)).toHaveLength(1);
  });
});
