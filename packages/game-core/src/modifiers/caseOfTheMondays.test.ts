import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { listBotMoves } from '../engine/bot';
import type { Color, GameState, Move, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { isMonday, isMondayLimited } from './definitions/case-of-the-mondays';
import { getBindingMoveRules } from './move-rules';
import { makeEmptyState, makePiece, move } from './testHelpers';

const MONDAYS = MODIFIER_IDS.caseOfTheMondays;

function startWith(extra: Array<{ id: string; sourceColor: Color }> = []): GameState {
  return chessEngine.beginTurn(
    chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [{ id: MONDAYS, sourceColor: 'white' }, ...extra]),
  );
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

function withMondays(pieces: Piece[]): GameState {
  return chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), ...pieces]),
    [{ id: MONDAYS, sourceColor: 'white' }],
  );
}

describe('MOD-B011 Case Of The Mondays', () => {
  it('blocks moves longer than 2 squares; 2-square pawn pushes and knights are fine', () => {
    let state = startWith();
    expect(chessEngine.validateMove(state, move('e2', 'e4', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('g1', 'f3', 'white')).valid).toBe(true);
    state = play(state, [['e2', 'e4'], ['e7', 'e5']]);
    const far = chessEngine.validateMove(state, move('f1', 'b5', 'white'));
    expect(far.valid).toBe(false);
    expect(far.reason).toMatch(/Case Of The Mondays/);
    expect(chessEngine.validateMove(state, move('f1', 'd3', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('d1', 'h5', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d1', 'f3', 'white')).valid).toBe(true);
  });

  it('ends after your 6th move, and the feed says so', () => {
    let state = startWith();
    state = play(state, [
      ['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['b1', 'c3'], ['g8', 'f6'],
      ['d2', 'd3'], ['d7', 'd6'], ['a2', 'a3'], ['a7', 'a6'],
    ]);
    expect(isMonday(state, 'white')).toBe(true);
    state = play(state, [['h2', 'h3'], ['h7', 'h6']]);
    expect(isMonday(state, 'white')).toBe(false);
    expect(state.eventHistory[state.eventHistory.length - 1]?.modifierId).toBe(MONDAYS);
    // Announced once, even if the turn is begun again.
    const count = state.eventHistory.filter(e => e.modifierId === MONDAYS).length;
    expect(chessEngine.beginTurn(state).eventHistory.filter(e => e.modifierId === MONDAYS).length).toBe(count);
    expect(chessEngine.validateMove(state, move('c1', 'h6', 'white')).valid).toBe(true);
  });

  it('a pass on your 6th move still ends Monday with a message', () => {
    let state = startWith();
    state = play(state, [
      ['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['b1', 'c3'], ['g8', 'f6'],
      ['d2', 'd3'], ['d7', 'd6'], ['a2', 'a3'], ['a7', 'a6'],
    ]);
    state = chessEngine.passTurn(state);
    state = play(state, [['h7', 'h6']]);
    expect(isMonday(state, 'white')).toBe(false);
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toMatch(/coffee/);
  });

  it('abilities are not limited: a rook may fire down the board', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('rook', 'white', 'a1'), makePiece('knight', 'black', 'a7')]),
      [{ id: MONDAYS, sourceColor: 'white' }, { id: MODIFIER_IDS.forTheEmperor, sourceColor: 'white' }],
    );
    expect(chessEngine.validateMove(state, move('a1', 'a7', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('a1', 'a7', 'white', { ability: MODIFIER_IDS.forTheEmperor })).valid).toBe(true);
  });

  it('castling is allowed', () => {
    const state = withMondays([makePiece('rook', 'white', 'h1'), makePiece('rook', 'white', 'a1')]);
    state.flags.castlingRights.white = { kingSide: true, queenSide: true };
    expect(chessEngine.validateMove(state, move('e1', 'g1', 'white', { isCastle: 'kingside' })).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('e1', 'c1', 'white', { isCastle: 'queenside' })).valid).toBe(true);
  });

  it('in check, any legal move is allowed', () => {
    const state = withMondays([makePiece('rook', 'black', 'e5'), makePiece('rook', 'white', 'a5')]);
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(isMondayLimited(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('a5', 'e5', 'white')).valid).toBe(true);
  });

  it('never softlocks: if only long moves exist, any move is allowed', () => {
    // King a1 boxed in by eggs (they never move) and a camel, which always jumps 3.
    const state = withMondays([]);
    state.pieces.delete('e1');
    for (const piece of [
      makePiece('king', 'white', 'a1'),
      makePiece('camel', 'white', 'b1'),
      makePiece('egg', 'white', 'a2'),
      makePiece('egg', 'white', 'b2'),
    ]) state.pieces.set(piece.square, piece);
    expect(isMonday(state, 'white')).toBe(true);
    expect(isMondayLimited(state, 'white')).toBe(false);
    const camel = chessEngine.getLegalMoves(state, 'b1');
    expect(camel.length).toBeGreaterThan(0);
    expect(chessEngine.validateMove(state, move('b1', camel[0], 'white')).valid).toBe(true);
    expect(chessEngine.hasAnyValidMove(state)).toBe(true);
  });

  it('only binds the owner', () => {
    const state = withMondays([makePiece('rook', 'black', 'a8')]);
    state.turn = 'black';
    expect(chessEngine.validateMove(state, move('a8', 'a2', 'black')).valid).toBe(true);
  });

  it('bots only play short moves', () => {
    const state = withMondays([makePiece('queen', 'white', 'd1'), makePiece('rook', 'white', 'a1')]);
    const moves = listBotMoves(state, 'white');
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      const span = Math.max(Math.abs(m.from.charCodeAt(0) - m.to.charCodeAt(0)), Math.abs(+m.from[1] - +m.to[1]));
      expect(span).toBeLessThanOrEqual(2);
    }
  });

  it('Main Character Syndrome: the Queen demand only asks for a short Queen move', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('queen', 'white', 'd1'), makePiece('knight', 'white', 'b1')]),
      [{ id: MONDAYS, sourceColor: 'white' }, { id: MODIFIER_IDS.mainCharacterSyndrome, sourceColor: 'white' }],
    );
    state.turnNumber = 9; // white's 5th move, Queen never moved
    expect(getBindingMoveRules(state, 'white').map(b => b.id)).toEqual([MONDAYS, MODIFIER_IDS.mainCharacterSyndrome]);
    expect(chessEngine.validateMove(state, move('d1', 'd5', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d1', 'd3', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('b1', 'c3', 'white')).valid).toBe(false);
  });

  it('Peer Pressure: pawn captures are 1 square, so both rules hold together', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('pawn', 'white', 'd4'), makePiece('knight', 'black', 'e5'), makePiece('rook', 'white', 'a1')]),
      [{ id: MONDAYS, sourceColor: 'white' }, { id: MODIFIER_IDS.peerPressure, sourceColor: 'white' }],
    );
    expect(getBindingMoveRules(state, 'white').map(b => b.id)).toEqual([MONDAYS, MODIFIER_IDS.peerPressure]);
    expect(chessEngine.validateMove(state, move('d4', 'e5', 'white')).valid).toBe(true);
  });
});
