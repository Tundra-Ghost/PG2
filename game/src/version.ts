/** This build of the game. Scheme: docs/versioning.md. */
export interface BuildInfo {
  version: string;
  commit: string;
  builtAt: string;
}

export const GAME_BUILD: BuildInfo =
  typeof __BUILD_INFO__ !== 'undefined' && __BUILD_INFO__
    ? __BUILD_INFO__
    : { version: '0.0.0-dev', commit: 'unknown', builtAt: '' };

/** "0.2026.11.27.3 · abc1234 · built 27 Nov 2026". */
export function describeBuild(build: BuildInfo): string {
  const date = build.builtAt ? new Date(build.builtAt) : null;
  const built = date && !Number.isNaN(date.getTime())
    ? ` · built ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
    : '';
  return `${build.version} · ${build.commit}${built}`;
}
