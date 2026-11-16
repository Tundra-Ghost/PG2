import { describe, expect, it } from 'vitest';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import type { GameSummary } from '@pigeon-chess/game-core';
import { abandonCountsAsLoss, abandonLabel, resumeLabel, describeOnline, describeSave, describeSeat, lastPlayedText } from './ongoingGames';
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

  it('gives two drafts against the same bot different Resume and Abandon labels (#141)', () => {
    const empty = describeSave(
      save({ draft: { playerIds: [], botIds: [], turn: 'player', randomLocked: false, seed: 1, draws: 0 } }),
      NOW,
    );
    const picked = describeSave(
      save({ draft: { playerIds: [MODIFIER_IDS.gerald], botIds: [], turn: 'opponent', randomLocked: false, seed: 1, draws: 1 } }),
      NOW,
    );
    expect(abandonLabel(empty)).toMatch(/^Abandon game against .+\. Drafting\. Modifier draft, nothing picked yet\./);
    expect(abandonLabel(picked)).toContain('Picked so far: ');
    expect(abandonLabel(empty)).not.toBe(abandonLabel(picked));
    expect(resumeLabel(picked)).toMatch(/^Resume game against .+\. Drafting\. Picked so far: /);
    expect(resumeLabel(empty)).not.toBe(resumeLabel(picked));
  });

  it('counts abandoning as a loss only for a started match not yet recorded', () => {
    const started = save({ match: { prngSeed: 1, playerModifierIds: [], botModifierIds: [], actions: [] }, summary: { turn: 'white', moves: 2 } });
    const untouched = save({ match: { prngSeed: 1, playerModifierIds: [], botModifierIds: [], actions: [] }, summary: { turn: 'white', moves: 0 } });
    const draft = save({ draft: { playerIds: [], botIds: [], turn: 'player', randomLocked: false, seed: 1, draws: 0 } });
    expect(abandonCountsAsLoss(started, true, new Set())).toBe(true);
    expect(abandonCountsAsLoss(started, false, new Set())).toBe(false);
    expect(abandonCountsAsLoss(started, true, new Set(['g']))).toBe(false);
    expect(abandonCountsAsLoss(untouched, true, new Set())).toBe(false);
    expect(abandonCountsAsLoss(draft, true, new Set())).toBe(false);
  });

  it('words the last played time', () => {
    expect(lastPlayedText('2026-11-16T11:59:40.000Z', NOW)).toBe('just now');
    expect(lastPlayedText('2026-11-16T09:00:00.000Z', NOW)).toBe('3 h ago');
    expect(lastPlayedText('2026-11-15T10:00:00.000Z', NOW)).toBe('yesterday');
    expect(lastPlayedText('2026-11-12T12:00:00.000Z', NOW)).toBe('4 days ago');
  });

  const summary = (extra: Partial<GameSummary>): GameSummary => ({
    roomId: 'ABCDE',
    color: 'black',
    turn: 'black',
    status: 'active',
    opponentJoined: true,
    opponentName: 'rook_lover',
    moveCount: 4,
    updatedAt: NOW - 3 * 3600_000,
    ...extra,
  });

  it('describes an online game from the server', () => {
    const row = describeOnline(summary({ modifiers: { yours: [MODIFIER_IDS.gerald], theirs: [] }, drafting: false }), NOW);
    expect(row.kind).toBe('online');
    expect(row.opponent).toBe('rook_lover');
    expect(row.side).toBe('You play Black · Room ABCDE');
    expect(row.status).toBe('Your move');
    expect(row.modifiers).toMatch(/^You: /);
    expect(row.lastPlayed).toBe('3 h ago');
    expect(describeOnline(summary({ turn: 'white' }), NOW).status).toBe('Their move');
  });

  it('words an online draft, an empty seat and an older server', () => {
    expect(describeOnline(summary({ drafting: true }), NOW).status).toBe('Drafting');
    const waiting = describeOnline(summary({ opponentJoined: false, opponentName: null }), NOW);
    expect(waiting.status).toBe('Waiting for opponent');
    expect(waiting.opponent).toBe('Open seat');
    expect(describeOnline(summary({}), NOW).modifiers).toBe('');
  });

  it('shows a saved seat as just Online when the server cannot be asked', () => {
    const row = describeSeat({ roomId: 'ZZZZZ', token: 't' });
    expect(row.status).toBe('Online');
    expect(row.opponent).toBe('Room ZZZZZ');
  });
});
