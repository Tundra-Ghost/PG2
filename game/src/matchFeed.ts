import type { GameEvent, GameState } from './engine/types';

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
