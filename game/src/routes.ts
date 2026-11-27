/** Every screen has its own address under the game's folder, e.g. pigeonchess.app/play/online. */
export type Screen =
  | 'menu'
  | 'botselect'
  | 'draft'
  | 'game'
  | 'settings'
  | 'profile'
  | 'roost'
  | 'collection'
  | 'online'
  | 'friends'
  | 'puzzles'
  | 'ongoing'
  | 'admin';

const PATHS: Record<Screen, string> = {
  menu: '',
  botselect: 'opponents',
  draft: 'draft',
  game: 'match',
  settings: 'settings',
  profile: 'profile',
  roost: 'stats',
  collection: 'collection',
  online: 'online',
  friends: 'friends',
  puzzles: 'puzzles',
  ongoing: 'games',
  admin: 'admin',
};

/** The game's folder: "/play/" on the site, "/" on the dev server. */
export function appBase(pathname: string): string {
  return pathname.match(/^(.*?\/play\/)/)?.[1] ?? '/';
}

export function pathFor(screen: Screen, base: string): string {
  return base + PATHS[screen];
}

/** Unknown addresses open the menu. */
export function screenFromPath(pathname: string, base: string): Screen {
  if (!pathname.startsWith(base)) return 'menu';
  const rest = pathname.slice(base.length).replace(/\/+$/, '');
  const match = (Object.keys(PATHS) as Screen[]).find(screen => PATHS[screen] === rest);
  return match ?? 'menu';
}

/** The save a history entry belongs to. Draft and match entries carry one. */
export function historySaveId(state: unknown): string | null {
  const id = (state as { saveId?: unknown } | null)?.saveId;
  return typeof id === 'string' ? id : null;
}

/**
 * Where Back or Forward lands. `current` is the screen being left (under
 * Settings if it is open), `next` the screen the address names.
 * `reopenable`: the entry's draft is still saved. A left draft reopens its
 * save; with none it goes to the menu, so Back never starts a second draft.
 */
export function popTarget(
  current: Screen,
  next: Screen,
  reopenable: boolean,
  hasBot: boolean,
): { screen: Screen; reopen: boolean } {
  // A finished or left match can't be reopened.
  if (next === 'game' && current !== 'game') return { screen: 'menu', reopen: false };
  if (next === 'draft' && current !== 'draft') {
    return reopenable ? { screen: 'draft', reopen: true } : { screen: 'menu', reopen: false };
  }
  if (next === 'draft' && !hasBot) return { screen: 'menu', reopen: false };
  return { screen: next, reopen: false };
}
