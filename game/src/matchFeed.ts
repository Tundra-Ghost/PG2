import type { GameEvent, GameState } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';

export interface MatchChatEntry {
  id: string;
  order: number;
  ply: number;
  author: string;
  text: string;
  source: 'player' | 'bot';
  avatarLabel: string;
  avatarIcon?: string | null;
  portraitSrc?: string | null;
  portraitSlotLabel?: string;
  dialogueTheme?: 'player' | 'chick' | 'measured' | 'grandmaster' | 'npc';
  dialogueExpression?: 'neutral' | 'shocked' | 'smug' | 'frustrated';
  shownInDialogue?: boolean;
}

export function getDerivedFeedOrder(
  state: GameState,
  chatEntries: MatchChatEntry[],
): number {
  const moveOrder = state.moveHistory.length * 100;
  const eventOrder = state.eventHistory.reduce(
    (max, event) => Math.max(max, event.ply * 100 + 50),
    0,
  );
  const chatOrder = chatEntries.reduce((max, entry) => Math.max(max, entry.order), 0);
  return Math.max(moveOrder, eventOrder, chatOrder);
}

export function getModifierEventBannerMessage(event: GameEvent): string {
  const message = `${event.title}: ${event.message}`;
  if (message.length <= 120) return message;
  return `${message.slice(0, 117)}...`;
}

/** Commentary-only events never take the banner from a real board event. */
const LOW_PRIORITY_EVENT_IDS = new Set<string>([MODIFIER_IDS.reginaldBeak]);

/**
 * The event the banner should announce, given every event that arrived since
 * the last announced one. Returns null when nothing new arrived.
 */
export function pickBannerEvent(
  events: readonly GameEvent[],
  lastAnnouncedId: string | null,
): GameEvent | null {
  const lastIndex = lastAnnouncedId ? events.findIndex(event => event.id === lastAnnouncedId) : -1;
  const fresh = events.slice(lastIndex + 1);
  if (fresh.length === 0) return null;
  const important = fresh.filter(event => !LOW_PRIORITY_EVENT_IDS.has(event.modifierId));
  return important[important.length - 1] ?? fresh[fresh.length - 1];
}
