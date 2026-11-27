import { apiCall } from './account';

/**
 * Anonymous usage stats: page loads, phone or desktop, and bot games. The
 * server keeps no IP address (see apps/server/src/usage.ts). Never blocks or
 * fails the game.
 */
export type UsageKind = 'visit' | 'bot_start' | 'bot_end';

export function deviceKind(): 'phone' | 'desktop' {
  try {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700 ? 'phone' : 'desktop';
  } catch {
    return 'desktop';
  }
}

const reported = new Set<string>();

/** Sends one event. With a key, the same key is only sent once per page load. */
export function reportUsage(kind: UsageKind, key?: string): void {
  if (key) {
    if (reported.has(`${kind}:${key}`)) return;
    reported.add(`${kind}:${key}`);
  }
  apiCall('/api/usage', { body: { kind, device: deviceKind() } }).catch(() => {});
}
