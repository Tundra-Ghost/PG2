import { ALL_MODIFIERS } from '@pigeon-chess/game-core';
import { getBotSpeaker } from './botChat';
import type { SavedBotGame } from './savedBotGames';

/** One row of the Ongoing games list, in words. */
export interface OngoingRow {
  id: string;
  opponent: string;
  portrait: string | null;
  /** "You play White". */
  side: string;
  /** "Your move", "Chick's move" or "Drafting". */
  status: string;
  yourMove: boolean;
  modifiers: string;
  lastPlayed: string;
  /** Abandoning records a loss, the same as leaving a started match always has. */
  abandonIsLoss: boolean;
}

function modifierName(id: string): string {
  return ALL_MODIFIERS.find(mod => mod.id === id)?.name ?? id;
}

function names(ids: string[]): string {
  return ids.map(modifierName).join(', ');
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then the date. */
export function lastPlayedText(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Plies played: from the summary, or the action count for a save without one. */
export function movesPlayed(save: SavedBotGame): number {
  return save.summary?.moves ?? save.match?.actions.length ?? 0;
}

/**
 * Giving up this save records a loss: a started match with a move played, for a
 * player with a profile, not already counted. Drafts and untouched boards are free.
 */
export function abandonCountsAsLoss(
  save: SavedBotGame,
  hasProfile: boolean,
  recordedIds: ReadonlySet<string>,
): boolean {
  return hasProfile && !!save.match && movesPlayed(save) > 0 && !recordedIds.has(save.id);
}

export function describeSave(save: SavedBotGame, now: number = Date.now()): OngoingRow {
  const bot = getBotSpeaker(save.bot);
  const opponent = bot?.name ?? 'Bot';
  const lastPlayed = lastPlayedText(save.updatedAt, now);
  if (!save.match) {
    const picks = save.draft?.playerIds ?? [];
    return {
      id: save.id,
      opponent,
      portrait: bot?.sprite ?? null,
      side: 'You play White',
      status: 'Drafting',
      yourMove: save.draft?.turn === 'player',
      modifiers: picks.length > 0 ? `Picked so far: ${names(picks)}` : 'Modifier draft, nothing picked yet',
      lastPlayed,
      abandonIsLoss: false,
    };
  }
  const { playerModifierIds, botModifierIds } = save.match;
  const parts: string[] = [];
  if (playerModifierIds.length > 0) parts.push(`You: ${names(playerModifierIds)}`);
  if (botModifierIds.length > 0) parts.push(`${opponent}: ${names(botModifierIds)}`);
  const turn = save.summary?.turn ?? 'white';
  return {
    id: save.id,
    opponent,
    portrait: bot?.sprite ?? null,
    side: 'You play White',
    status: turn === 'white' ? 'Your move' : `${opponent}'s move`,
    yourMove: turn === 'white',
    modifiers: parts.length > 0 ? parts.join(' · ') : 'Standard chess',
    lastPlayed,
    abandonIsLoss: movesPlayed(save) > 0,
  };
}
