import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { isOnSpeedrunClock, speedrunTimeoutMove } from './definitions/speedrun';
import { createOnlineDraft, draftPick } from '../draft/online';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.speedrun;

function start(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = [], seed = 1): GameState {
  const state = { ...makeEmptyState(pieces), prngState: seed };
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(state, [{ id: ID, sourceColor: 'white' }, ...extra]));
}

const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')];

describe('MOD-B009 Speedrun Any%', () => {
  it('only the owner is on the clock', () => {
    let state = start([...KINGS(), makePiece('pawn', 'white', 'b2'), makePiece('pawn', 'black', 'g7')]);
    expect(isOnSpeedrunClock(state)).toBe(true);
    state = chessEngine.applyMove(state, move('b2', 'b3', 'white'));
    expect(isOnSpeedrunClock(state)).toBe(false);
    expect(speedrunTimeoutMove(state)).toBeNull();
  });

  it('a timeout plays the seeded random legal move, the same for the same seed, and logs it', () => {
    const pieces = () => [...KINGS(), makePiece('rook', 'white', 'd1'), makePiece('knight', 'white', 'g1'), makePiece('pawn', 'black', 'g7')];
    const a = speedrunTimeoutMove(start(pieces(), [], 42))!;
    const b = speedrunTimeoutMove(start(pieces(), [], 42))!;
    expect(a).toEqual(b);
    expect(a.timedOut).toBe(true);
    const picks = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) picks.add(JSON.stringify(speedrunTimeoutMove(start(pieces(), [], seed))));
    expect(picks.size).toBeGreaterThan(3);

    const state = start(pieces(), [], 42);
    expect(chessEngine.validateMove(state, a).valid).toBe(true);
    const next = chessEngine.applyMove(state, a);
    expect(next.turn).toBe('black');
    expect(next.prngState).not.toBe(state.prngState);
    expect(next.eventHistory[next.eventHistory.length - 1]).toMatchObject({ modifierId: ID, title: 'Speedrun', message: expect.stringMatching(/ran out of time/) });
  });

  it('the engine refuses a timed-out move that is not the seeded pick', () => {
    const state = start([...KINGS(), makePiece('rook', 'white', 'd1'), makePiece('pawn', 'black', 'g7')]);
    const pick = speedrunTimeoutMove(state)!;
    const other = pick.to === 'd8' ? move('d1', 'd7', 'white', { timedOut: true }) : move('d1', 'd8', 'white', { timedOut: true });
    expect(chessEngine.validateMove(state, other).valid).toBe(false);
    expect(chessEngine.validateMove(state, { ...pick, extraTurn: true }).valid).toBe(false);
  });

  it('the random move never leaves the King in check', () => {
    // The rook on b2 is pinned to its King by the black rook on h2.
    for (let seed = 1; seed <= 40; seed++) {
      const state = start([makePiece('king', 'white', 'a2'), makePiece('rook', 'white', 'b2'), makePiece('rook', 'black', 'h2'), makePiece('king', 'black', 'h8')], [], seed);
      const pick = speedrunTimeoutMove(state)!;
      const next = chessEngine.applyMove(state, pick);
      expect(chessEngine.isInCheck(next, 'white')).toBe(false);
    }
  });

  it('a replay of the move list gives the same game', () => {
    const pieces = () => [...KINGS(), makePiece('rook', 'white', 'd1'), makePiece('knight', 'white', 'g1'), makePiece('pawn', 'black', 'g7')];
    let live = start(pieces(), [], 7);
    const log = [] as ReturnType<typeof move>[];
    const first = speedrunTimeoutMove(live)!;
    log.push(first);
    live = chessEngine.applyMove(live, first);
    log.push(move('g7', 'g6', 'black'));
    live = chessEngine.applyMove(live, log[1]);
    const second = speedrunTimeoutMove(live)!;
    log.push(second);
    live = chessEngine.applyMove(live, second);

    let replay = start(pieces(), [], 7);
    for (const m of log) {
      expect(chessEngine.validateMove(replay, m).valid).toBe(true);
      replay = chessEngine.applyMove(replay, m);
    }
    expect([...replay.pieces.keys()].sort()).toEqual([...live.pieces.keys()].sort());
    expect(replay.prngState).toBe(live.prngState);
  });

  it('interaction: One Way Street. The random move obeys the signs', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = start([...KINGS(), makePiece('rook', 'white', 'c5')], [{ id: MODIFIER_IDS.oneWayStreet, sourceColor: 'black' }], seed);
      const pick = speedrunTimeoutMove(state)!;
      if (pick.from === 'c5' && pick.to[0] === 'c') expect(Number(pick.to[1])).toBeGreaterThan(5);
    }
  });

  it('is not offered online, where games have no clock', () => {
    const ids = new Set(modifierRegistry.getAll().map(d => d.id));
    const card = ALL_MODIFIERS.find(c => c.id === ID)!;
    expect(getValidOptions([], [], ids).some(c => c.id === ID)).toBe(true);
    expect(getValidOptions([], [], ids, { online: true }).some(c => c.id === ID)).toBe(false);
    expect(pickBlocker(card, [], [], ids, 'Your opponent', { online: true })).toMatch(/online/);
    expect(draftPick(createOnlineDraft(), 'white', ID)).toMatchObject({ ok: false });
  });
});
