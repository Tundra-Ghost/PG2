import { ALL_MODIFIERS, type GameSummary, type SeatRef } from '@pigeon-chess/game-core';
import { getBotSpeaker } from './botChat';
import type { SavedBotGame } from './savedBotGames';

/** One row of the Ongoing games list, in words. */
export interface OngoingRow {
  /** A bot save id, or an online room code. */
  id: string;
  kind: 'bot' | 'online';
  /** Last played, for sorting the bot and online games together. */
  updatedMs: number;
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

/**
 * The Abandon button's label. It names the status, picks and last played time
 * so a screen reader can tell two games against the same bot apart.
 */
export function abandonLabel(row: OngoingRow): string {
  const parts = [`Abandon game against ${row.opponent}`, row.status, row.modifiers];
  if (row.lastPlayed) parts.push(`Last played ${row.lastPlayed}`);
  return parts.filter(Boolean).join('. ') + '.';
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
      kind: 'bot',
      updatedMs: Date.parse(save.updatedAt) || 0,
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
    kind: 'bot',
    updatedMs: Date.parse(save.updatedAt) || 0,
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

function modifierLine(yours: string[], theirs: string[], opponent: string): string {
  const parts: string[] = [];
  if (yours.length > 0) parts.push(`You: ${names(yours)}`);
  if (theirs.length > 0) parts.push(`${opponent}: ${names(theirs)}`);
  return parts.length > 0 ? parts.join(' · ') : 'Standard chess';
}

/** An online game the server told us about. */
export function describeOnline(game: GameSummary, now: number = Date.now()): OngoingRow {
  const opponent = game.opponentName ?? (game.opponentJoined ? 'Guest' : 'Open seat');
  const yourMove = game.opponentJoined && !game.drafting && game.turn === game.color;
  const status = game.drafting
    ? 'Drafting'
    : !game.opponentJoined
      ? 'Waiting for opponent'
      : yourMove
        ? 'Your move'
        : 'Their move';
  return {
    id: game.roomId,
    kind: 'online',
    updatedMs: game.updatedAt,
    opponent,
    portrait: null,
    side: `You play ${game.color === 'white' ? 'White' : 'Black'} · Room ${game.roomId}`,
    status,
    yourMove,
    // An older server does not send modifiers.
    modifiers: game.modifiers ? modifierLine(game.modifiers.yours, game.modifiers.theirs, opponent) : '',
    lastPlayed: lastPlayedText(new Date(game.updatedAt).toISOString(), now),
    abandonIsLoss: false,
  };
}

/** A saved seat while the server cannot say more about it. */
export function describeSeat(seat: SeatRef): OngoingRow {
  return {
    id: seat.roomId,
    kind: 'online',
    updatedMs: 0,
    opponent: `Room ${seat.roomId}`,
    portrait: null,
    side: 'Online game',
    status: 'Online',
    yourMove: false,
    modifiers: '',
    lastPlayed: '',
    abandonIsLoss: false,
  };
}
