import type { GameEvent, GameState } from '@pigeon-chess/game-core';
import { MODIFIER_IDS, blackoutMovesLeft, isHistoryBlackout, isMoveHidden, type Color } from '@pigeon-chess/game-core';

export interface MatchChatEntry {
  id: string;
  order: number;
  ply: number;
  author: string;
  text: string;
  source: 'player' | 'bot';
  /** Shown under a non-player line instead of "Bot", e.g. "Opponent" online. */
  sourceLabel?: string;
  avatarLabel: string;
  avatarIcon?: string | null;
  portraitSrc?: string | null;
  portraitSlotLabel?: string;
  dialogueTheme?: 'player' | 'chick' | 'measured' | 'grandmaster' | 'npc';
  dialogueExpression?: 'neutral' | 'shocked' | 'smug' | 'frustrated';
  shownInDialogue?: boolean;
  /** Already shown on screen as it was spoken, so it needs no chat bubble. */
  spokenLive?: boolean;
}

export function formatActorMove(label: string, notation: string): string {
  return label === 'You' ? `${label} play: ${notation}` : `${label} plays: ${notation}`;
}

export function formatEventMessage(message: string, whiteLabel: string, blackLabel: string): string {
  return message
    .replace(/\bwhite ([a-z_]+)/gi, `${whiteLabel}'s $1`)
    .replace(/\bblack ([a-z_]+)/gi, `${blackLabel}'s $1`)
    .replace(/\bwhite\b/gi, whiteLabel)
    .replace(/\bblack\b/gi, blackLabel);
}

/**
 * The newest move or modifier event as one line, for the ticker under the
 * board. Follows the same rules as the log, so a side under 50 First Moves
 * can't read the moves here either.
 */
export function latestFeedLine(state: GameState, whiteLabel: string, blackLabel: string, viewer?: Color): string {
  const { moveHistory, eventHistory } = state;
  if (state.status === 'active' && isHistoryBlackout(state, viewer ?? state.turn)) {
    const left = blackoutMovesLeft(state);
    return `You cannot remember any moves. Memory returns in ${left} move${left === 1 ? '' : 's'}.`;
  }
  const lastEvent = eventHistory[eventHistory.length - 1];
  if (lastEvent && lastEvent.ply >= moveHistory.length) {
    return `${lastEvent.title}: ${formatEventMessage(lastEvent.message, whiteLabel, blackLabel)}`;
  }
  const lastMove = moveHistory[moveHistory.length - 1];
  if (!lastMove) return 'No moves yet.';
  const actor = lastMove.pieceMoved.color === 'white' ? whiteLabel : blackLabel;
  if (isMoveHidden(state, lastMove, viewer ?? state.turn)) return `${actor} moves in the dark.`;
  return formatActorMove(actor, lastMove.notation);
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
