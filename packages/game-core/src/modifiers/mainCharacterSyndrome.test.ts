import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove, listBotMoves } from '../engine/bot';
import type { Color, GameState, Move, Piece, Square } from '../engine/types';
import './index';
import { getShooBlocker } from '../engine/gameLoop';
import { MODIFIER_IDS } from './ids';
import { isQueenDemanded, mustMoveQueen } from './definitions/main-character-syndrome';
import { touchPiece } from './definitions/commitment-issues';
import { getBindingMoveRules } from './move-rules';
import { pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';
import { ownMoveNumber } from './owner';

const MCS = MODIFIER_IDS.mainCharacterSyndrome;

function startWith(picks: Array<{ id: string; sourceColor: Color }>): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(chessEngine.getInitialState(), picks));
}

function play(state: GameState, moves: Array<[Square, Square]>): GameState {
  let next = state;
  for (const [from, to] of moves) {
    const m: Move = { from, to, playerColor: next.turn };
    const result = chessEngine.validateMove(next, m);
    if (!result.valid) throw new Error(`${from}-${to}: ${result.reason}`);
    next = chessEngine.applyMove(next, m);
  }
  return next;
}

function withMcs(pieces: Piece[], owner: Color = 'white'): GameState {
  return chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), ...pieces]),
    [{ id: MCS, sourceColor: owner }],
  );
}

describe('MOD-B010 Main Character Syndrome', () => {
  it('after 3 moves without her, the 4th must be a Queen move', () => {
    let state = startWith([{ id: MCS, sourceColor: 'white' }]);
    state = play(state, [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6']]);
    expect(isQueenDemanded(state, 'white')).toBe(false);
    state = play(state, [['b1', 'c3'], ['g8', 'f6']]);
    expect(isQueenDemanded(state, 'white')).toBe(true);
    expect(mustMoveQueen(state, 'white')).toBe(true);
    const knight = chessEngine.validateMove(state, move('f3', 'g5', 'white'));
    expect(knight.valid).toBe(false);
    expect(knight.reason).toMatch(/Main Character Syndrome/);
    expect(chessEngine.validateMove(state, move('d1', 'e2', 'white')).valid).toBe(true);
  });

  it('a Queen move resets the count', () => {
    let state = startWith([{ id: MCS, sourceColor: 'white' }]);
    state = play(state, [
      ['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'],
      ['g1', 'f3'], ['g8', 'f6'], ['b1', 'c3'], ['f8', 'c5'], ['a2', 'a3'], ['a7', 'a6'],
    ]);
    expect(isQueenDemanded(state, 'white')).toBe(true);
    state = play(state, [['h5', 'h4'], ['h7', 'h6']]);
    expect(isQueenDemanded(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('a3', 'a4', 'white')).valid).toBe(true);
  });

  it('warns in the feed one move ahead', () => {
    let state = startWith([{ id: MCS, sourceColor: 'white' }]);
    state = play(state, [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['b1', 'c3']]);
    const last = state.eventHistory[state.eventHistory.length - 1];
    expect(last?.modifierId).toBe(MCS);
    expect(last?.message).toMatch(/Queen/);
  });

  it('if she has no legal move, any move is allowed and she stays owed', () => {
    let state = startWith([{ id: MCS, sourceColor: 'white' }]);
    state = play(state, [['a2', 'a3'], ['a7', 'a6'], ['h2', 'h3'], ['h7', 'h6'], ['g1', 'f3'], ['b8', 'c6']]);
    expect(isQueenDemanded(state, 'white')).toBe(true);
    expect(mustMoveQueen(state, 'white')).toBe(false);
    state = play(state, [['e2', 'e4'], ['g8', 'f6']]);
    expect(mustMoveQueen(state, 'white')).toBe(true);
    expect(chessEngine.validateMove(state, move('d2', 'd3', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d1', 'e2', 'white')).valid).toBe(true);
  });

  it('in check, any legal move is allowed', () => {
    const state = withMcs([makePiece('queen', 'white', 'a1'), makePiece('rook', 'black', 'e7'), makePiece('rook', 'white', 'h2')]);
    state.turnNumber = 9; // white's 5th move, Queen never moved
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(isQueenDemanded(state, 'white')).toBe(true);
    expect(mustMoveQueen(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('h2', 'e2', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('e1', 'd2', 'white')).valid).toBe(true);
  });

  it('only binds the owner', () => {
    const state = withMcs([makePiece('queen', 'black', 'd8'), makePiece('rook', 'black', 'a8')], 'white');
    state.turn = 'black';
    state.turnNumber = 10;
    expect(isQueenDemanded(state, 'black')).toBe(false);
    expect(chessEngine.validateMove(state, move('a8', 'a7', 'black')).valid).toBe(true);
  });

  it('no Gerald shoo while she is owed', () => {
    const state = withMcs([
      makePiece('queen', 'white', 'd1'),
      { ...makePiece('rook', 'white', 'a1'), cooldowns: { [MODIFIER_IDS.gerald]: 2 } },
    ]);
    state.turnNumber = 9;
    expect(getShooBlocker(state)).toMatch(/Main Character Syndrome/);
    expect(chessEngine.canShooGerald(state)).toBe(false);
  });

  it('once the Queen is gone the curse is over, even after a promotion', () => {
    let state = withMcs([
      makePiece('queen', 'white', 'd4'),
      makePiece('rook', 'black', 'd8'),
      makePiece('pawn', 'white', 'h6'),
      makePiece('pawn', 'black', 'a7'),
    ]);
    state.turn = 'black';
    state.turnNumber = 2;
    state = chessEngine.beginTurn(state);
    state = play(state, [['d8', 'd4']]);
    expect(state.modifierState[MCS]).toMatchObject({ ended: { white: true } });
    state = play(state, [['h6', 'h7'], ['a7', 'a6']]);
    state = chessEngine.applyMove(state, move('h7', 'h8', 'white', { promotion: 'queen' }));
    state.turnNumber = 41;
    state.turn = 'white';
    expect(isQueenDemanded(state, 'white')).toBe(false);
  });

  it('never softlocks: a lone King with a Queen that cannot move still has a move', () => {
    const state = withMcs([
      makePiece('queen', 'white', 'a1'),
      makePiece('pawn', 'white', 'a2'),
      makePiece('rook', 'white', 'b1'),
      makePiece('pawn', 'white', 'b2'),
    ]);
    state.turnNumber = 21;
    expect(isQueenDemanded(state, 'white')).toBe(true);
    expect(chessEngine.hasAnyValidMove(state)).toBe(true);
    expect(chessEngine.validateMove(state, move('e1', 'e2', 'white')).valid).toBe(true);
  });

  it('bots play only Queen moves while she is owed', () => {
    const state = withMcs([makePiece('queen', 'white', 'd1'), makePiece('knight', 'white', 'b1')]);
    state.turnNumber = 9;
    const moves = listBotMoves(state, 'white');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.from === 'd1')).toBe(true);
    expect(getChickBotMove(state, 'white', () => 0)?.from).toBe('d1');
  });

  it('Commitment Issues: you cannot touch another piece while she is owed', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('king', 'black', 'e8'),
        makePiece('queen', 'white', 'd1'),
        makePiece('knight', 'white', 'b1'),
      ]),
      [{ id: MCS, sourceColor: 'white' }, { id: MODIFIER_IDS.commitmentIssues, sourceColor: 'white' }],
    );
    state.turnNumber = 9;
    expect(touchPiece(state, 'b1')).toBe(state);
    expect(touchPiece(state, 'd1').pieces.get('d1')?.isTouched).toBe(true);
  });

  it('Peer Pressure on the same side: the capture wins, and there is always a move', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('king', 'black', 'e8'),
        makePiece('queen', 'white', 'a1'),
        makePiece('pawn', 'white', 'd4'),
        makePiece('knight', 'black', 'e5'),
      ]),
      [{ id: MODIFIER_IDS.peerPressure, sourceColor: 'white' }, { id: MCS, sourceColor: 'white' }],
    );
    state.turnNumber = 9;
    expect(getBindingMoveRules(state, 'white').map(b => b.id)).toEqual([MODIFIER_IDS.peerPressure]);
    expect(chessEngine.validateMove(state, move('d4', 'e5', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('a1', 'a2', 'white')).valid).toBe(false);
  });

  it('cannot be drafted with Peer Pressure or Three Kings on the same side', () => {
    const card = ALL_MODIFIERS.find(c => c.id === MCS)!;
    const all = new Set(ALL_MODIFIERS.map(c => c.id));
    expect(pickBlocker(card, [MODIFIER_IDS.peerPressure], [], all)).toMatch(/Peer Pressure/);
    expect(pickBlocker(card, [MODIFIER_IDS.threeKings], [], all)).toMatch(/Three Of Them/);
    expect(pickBlocker(card, [], [MODIFIER_IDS.peerPressure], all)).toBeNull();
  });
  it('counts your own moves even when the other side takes extra turns', () => {
    let state = startWith([{ id: MCS, sourceColor: 'white' }]);
    state.tempoTokens = { white: 0, black: 2 };
    state = play(state, [['e2', 'e4']]);
    state = chessEngine.applyMove(state, move('e7', 'e5', 'black', { extraTurn: true }));
    state = chessEngine.applyMove(state, move('d7', 'd6', 'black', { extraTurn: true }));
    state = play(state, [['c7', 'c6'], ['g1', 'f3']]);
    expect(ownMoveNumber(state, 'black')).toBe(4);
    state = play(state, [['b8', 'd7']]);
    expect(ownMoveNumber(state, 'white')).toBe(3);
    expect(isQueenDemanded(state, 'white')).toBe(false);
    state = play(state, [['b1', 'c3'], ['g8', 'f6']]);
    expect(ownMoveNumber(state, 'white')).toBe(4);
    expect(isQueenDemanded(state, 'white')).toBe(true);
  });

  it('her ability counts as a Queen move', () => {
    let state = chessEngine.activateDraftModifiers(
      makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('queen', 'white', 'd4')]),
      [{ id: MCS, sourceColor: 'white' }, { id: MODIFIER_IDS.quietQuitting, sourceColor: 'white' }],
    );
    state.turnNumber = 9;
    state = chessEngine.beginTurn(state);
    expect(mustMoveQueen(state, 'white')).toBe(true);
    const zone = move('d4', 'd4', 'white', { ability: MODIFIER_IDS.quietQuitting });
    expect(chessEngine.validateMove(state, zone).valid).toBe(true);
    state = chessEngine.applyMove(state, zone);
    state = play(state, [['e8', 'f8']]);
    expect(isQueenDemanded(state, 'white')).toBe(false);
  });
});
