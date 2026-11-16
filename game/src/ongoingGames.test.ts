import { describe, expect, it } from 'vitest';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import { describeSave, lastPlayedText } from './ongoingGames';
import { SAVE_VERSION, type SavedBotGame } from './savedBotGames';

const NOW = Date.parse('2026-11-16T12:00:00.000Z');

function save(extra: Partial<SavedBotGame>): SavedBotGame {
  return {
    v: SAVE_VERSION,
    id: 'g',
    bot: 'chick',
    mode: 'run',
    matchMode: 'story',
    startedAt: '2026-11-16T11:00:00.000Z',
    updatedAt: '2026-11-16T11:55:00.000Z',
    ...extra,
  };
}

describe('ongoing games rows', () => {
  it('describes a match: opponent, side, whose move and modifiers', () => {
    const row = describeSave(
      save({
        match: { prngSeed: 1, playerModifierIds: [MODIFIER_IDS.gerald], botModifierIds: [], actions: [] },
        summary: { turn: 'black', moves: 3 },
      }),
      NOW,
    );
    expect(row.opponent).toBe('Chick');
    expect(row.side).toBe('You play White');
    expect(row.status).toBe("Chick's move");
    expect(row.yourMove).toBe(false);
    expect(row.modifiers).toMatch(/^You: /);
    expect(row.lastPlayed).toBe('5 min ago');
    expect(row.abandonIsLoss).toBe(true);
  });

  it('calls a standard game with no moves free to abandon', () => {
    const row = describeSave(
      save({ mode: 'quick', match: { prngSeed: 1, playerModifierIds: [], botModifierIds: [], actions: [] }, summary: { turn: 'white', moves: 0 } }),
      NOW,
    );
    expect(row.modifiers).toBe('Standard chess');
    expect(row.status).toBe('Your move');
    expect(row.abandonIsLoss).toBe(false);
  });

  it('shows a draft as drafting, never a loss', () => {
    const row = describeSave(
      save({ draft: { playerIds: [], botIds: [], turn: 'player', randomLocked: false, seed: 1, draws: 0 } }),
      NOW,
    );
    expect(row.status).toBe('Drafting');
    expect(row.abandonIsLoss).toBe(false);
  });

  it('words the last played time', () => {
    expect(lastPlayedText('2026-11-16T11:59:40.000Z', NOW)).toBe('just now');
    expect(lastPlayedText('2026-11-16T09:00:00.000Z', NOW)).toBe('3 h ago');
    expect(lastPlayedText('2026-11-15T10:00:00.000Z', NOW)).toBe('yesterday');
    expect(lastPlayedText('2026-11-12T12:00:00.000Z', NOW)).toBe('4 days ago');
  });
});
