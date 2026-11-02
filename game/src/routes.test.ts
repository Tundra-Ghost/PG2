import { describe, expect, it } from 'vitest';
import { appBase, pathFor, screenFromPath } from './routes';

describe('routes', () => {
  it('finds the game folder on the site and on the dev server', () => {
    expect(appBase('/play/online')).toBe('/play/');
    expect(appBase('/PG2/play/')).toBe('/PG2/play/');
    expect(appBase('/online')).toBe('/');
  });

  it('round-trips every screen', () => {
    for (const screen of ['menu', 'online', 'roost', 'botselect', 'game'] as const) {
      expect(screenFromPath(pathFor(screen, '/play/'), '/play/')).toBe(screen);
    }
  });

  it('ignores a trailing slash and sends unknown paths to the menu', () => {
    expect(screenFromPath('/play/online/', '/play/')).toBe('online');
    expect(screenFromPath('/play/nope', '/play/')).toBe('menu');
  });
});
