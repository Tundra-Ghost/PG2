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
  | 'puzzles';

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
