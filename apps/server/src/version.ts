import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface BuildInfo {
  version: string;
  commit: string;
  builtAt: string;
}

const serverDir = fileURLToPath(new URL('..', import.meta.url));
const script = fileURLToPath(new URL('../../../scripts/build-info.mjs', import.meta.url));

/**
 * The server's version. The deploy writes build-info.json (no git inside the
 * Docker image); locally it is worked out from git the same way the game does.
 */
export function readBuildInfo(): BuildInfo {
  try {
    const file = `${serverDir}build-info.json`;
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as BuildInfo;
    if (existsSync(script)) return JSON.parse(execFileSync(process.execPath, [script], { encoding: 'utf8' })) as BuildInfo;
  } catch {
    // Fall through to the dev version.
  }
  return { version: '0.0.0-dev', commit: 'unknown', builtAt: new Date().toISOString() };
}
