// Version, commit and build date for the game and the server.
// Scheme (docs/versioning.md): 0.YYYY.MM.DD.N, where the date is the UTC day of
// the commit on main and N counts main's commits that day (1 = the first).
// Run directly to print JSON:  node scripts/build-info.mjs > apps/server/build-info.json
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

export function buildInfo() {
  const builtAt = new Date().toISOString();
  try {
    const commit = git('rev-parse', '--short=7', 'HEAD');
    const when = new Date(git('log', '-1', '--format=%cI', 'HEAD'));
    const day = when.toISOString().slice(0, 10);
    // First-parent commits on the same UTC day, up to and including this one.
    const sameDay = git('log', '--first-parent', '--format=%cI', '-200', 'HEAD')
      .split('\n')
      .filter(line => line && new Date(line).toISOString().slice(0, 10) === day).length;
    const [y, m, d] = day.split('-');
    return { version: `0.${y}.${m}.${d}.${Math.max(1, sameDay)}`, commit, builtAt };
  } catch {
    return { version: '0.0.0-dev', commit: 'unknown', builtAt };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(buildInfo()));
}
