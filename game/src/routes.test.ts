import { describe, expect, it } from 'vitest';
import { appBase, historySaveId, pathFor, popTarget, screenFromPath } from './routes';

describe('routes', () => {
  it('finds the game folder on the site and on the dev server', () => {
    expect(appBase('/play/online')).toBe('/play/');
    expect(appBase('/PG2/play/')).toBe('/PG2/play/');
    expect(appBase('/online')).toBe('/');
  });

  it('round-trips every screen', () => {
    for (const screen of ['menu', 'online', 'roost', 'botselect', 'game', 'ongoing'] as const) {
      expect(screenFromPath(pathFor(screen, '/play/'), '/play/')).toBe(screen);
    }
  });

  it('ignores a trailing slash and sends unknown paths to the menu', () => {
    expect(screenFromPath('/play/online/', '/play/')).toBe('online');
    expect(screenFromPath('/play/nope', '/play/')).toBe('menu');
  });
});

describe('Back and Forward (#141)', () => {
  it('reads the save id a history entry carries', () => {
    expect(historySaveId({ saveId: 'abc' })).toBe('abc');
    expect(historySaveId(null)).toBeNull();
    expect(historySaveId({ saveId: 3 })).toBeNull();
  });

  it('reopens a left draft that is still saved', () => {
    expect(popTarget('botselect', 'draft', true, true)).toEqual({ screen: 'draft', reopen: true });
    expect(popTarget('menu', 'draft', true, false)).toEqual({ screen: 'draft', reopen: true });
  });

  it('goes to the menu when the draft is gone or became a match, never a new draft', () => {
    expect(popTarget('botselect', 'draft', false, true)).toEqual({ screen: 'menu', reopen: false });
    expect(popTarget('menu', 'game', false, true)).toEqual({ screen: 'menu', reopen: false });
  });

  it('keeps the draft under the Settings overlay without reopening it', () => {
    expect(popTarget('draft', 'draft', false, true)).toEqual({ screen: 'draft', reopen: false });
    expect(popTarget('draft', 'draft', false, false)).toEqual({ screen: 'menu', reopen: false });
  });

  it('passes other screens through', () => {
    expect(popTarget('draft', 'botselect', false, true)).toEqual({ screen: 'botselect', reopen: false });
  });
});
