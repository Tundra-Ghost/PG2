import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { LAG_EVERY, isLagDue, movesUntilLag } from './definitions/rubber-banding';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.rubberBanding;

function start(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: ID, sourceColor: 'white' }, ...extra]));
}

/** Kings shuffle a1-b1 and h8-g8 until White is about to make its `n`th move. */
function toWhiteMove(state: GameState, n: number): GameState {
  const steps: Record<string, Square> = { a1: 'b1', b1: 'a1', h8: 'g8', g8: 'h8' };
  while (!(state.turn === 'white' && (state.ownMoves?.white ?? 0) === n - 1)) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn)!;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')];

describe('MOD-B018 Rubber Banding', () => {
  it('the ping counter counts down to the 7th move', () => {
    let state = start([...KINGS(), makePiece('rook', 'white', 'd1')]);
    expect(movesUntilLag(state, 'white')).toBe(6);
    expect(movesUntilLag(state, 'black')).toBeNull();
    state = toWhiteMove(state, LAG_EVERY);
    expect(movesUntilLag(state, 'white')).toBe(0);
    expect(isLagDue(state, 'white')).toBe(true);
  });

  it('the 7th move snaps back, the turn passes, and the next lag is the 14th', () => {
    let state = toWhiteMove(start([...KINGS(), makePiece('rook', 'white', 'd1')]), LAG_EVERY);
    state = chessEngine.applyMove(state, move('d1', 'd5', 'white'));
    expect(state.turn).toBe('black');
    expect(state.pieces.get('d1')).toMatchObject({ type: 'rook', color: 'white' });
    expect(state.pieces.get('d5')).toBeUndefined();
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: ID, title: 'LAG' });
    expect(movesUntilLag(state, 'white')).toBe(6);
    state = toWhiteMove(state, 2 * LAG_EVERY);
    expect(isLagDue(state, 'white')).toBe(true);
  });

  it('a capture never lags; the lag waits for the next move that can', () => {
    let state = toWhiteMove(start([...KINGS(), makePiece('rook', 'white', 'd1'), makePiece('pawn', 'black', 'd5')]), LAG_EVERY);
    state = chessEngine.applyMove(state, move('d1', 'd5', 'white'));
    expect(state.pieces.get('d5')).toMatchObject({ type: 'rook', color: 'white' });
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(isLagDue(state, 'white')).toBe(true);
    state = chessEngine.applyMove(state, move('d5', 'd3', 'white'));
    expect(state.pieces.get('d5')).toMatchObject({ type: 'rook' });
    expect(isLagDue(state, 'white')).toBe(false);
  });

  it('a move out of check never lags', () => {
    let state = start([...KINGS(), makePiece('rook', 'white', 'c3'), makePiece('rook', 'black', 'e7')]);
    state = { ...state, ownMoves: { white: LAG_EVERY - 1, black: LAG_EVERY - 1 }, turn: 'black' };
    const checked = chessEngine.applyMove(state, move('e7', 'e1', 'black'));
    expect(chessEngine.isInCheck(checked, 'white')).toBe(true);
    expect(isLagDue(checked, 'white')).toBe(true);
    const out = chessEngine.applyMove(checked, move('c3', 'c1', 'white'));
    expect(out.pieces.get('c1')).toMatchObject({ type: 'rook', color: 'white' });
  });

  it('castling and promotion never lag', () => {
    let state = start([makePiece('king', 'white', 'e1'), makePiece('rook', 'white', 'h1'), makePiece('pawn', 'white', 'a7'), makePiece('king', 'black', 'h8')]);
    state.flags.castlingRights = { white: { kingSide: true, queenSide: false }, black: { kingSide: false, queenSide: false } };
    state = { ...state, ownMoves: { white: LAG_EVERY - 1, black: LAG_EVERY - 1 } };
    expect(isLagDue(state, 'white')).toBe(true);
    const castled = chessEngine.applyMove(state, move('e1', 'g1', 'white', { isCastle: 'kingside' }));
    expect(castled.pieces.get('g1')).toMatchObject({ type: 'king' });
    const promoted = chessEngine.applyMove(state, move('a7', 'a8', 'white', { promotion: 'queen' }));
    expect(promoted.pieces.get('a8')).toMatchObject({ type: 'queen' });
  });

  it('a snapped-back King keeps its castling rights and a snapped pawn gives no en passant', () => {
    let state = start([makePiece('king', 'white', 'e1'), makePiece('rook', 'white', 'h1'), makePiece('pawn', 'white', 'b2'), makePiece('king', 'black', 'h8'), makePiece('pawn', 'black', 'c4')]);
    state.flags.castlingRights = { white: { kingSide: true, queenSide: false }, black: { kingSide: false, queenSide: false } };
    state = { ...state, ownMoves: { white: LAG_EVERY - 1, black: LAG_EVERY - 1 } };
    const kingLag = chessEngine.applyMove(state, move('e1', 'e2', 'white'));
    expect(kingLag.pieces.get('e1')).toMatchObject({ type: 'king' });
    expect(kingLag.flags.castlingRights.white.kingSide).toBe(true);
    const pawnLag = chessEngine.applyMove(state, move('b2', 'b4', 'white'));
    expect(pawnLag.pieces.get('b2')).toMatchObject({ type: 'pawn' });
    expect(pawnLag.flags.enPassantSquare).toBeNull();
    expect(chessEngine.validateMove(pawnLag, move('c4', 'b3', 'black')).valid).toBe(false);
  });

  it('only the owner lags', () => {
    let state = start([...KINGS(), makePiece('rook', 'black', 'd8')]);
    state = { ...state, ownMoves: { white: LAG_EVERY, black: LAG_EVERY - 1 }, turn: 'black' };
    const next = chessEngine.applyMove(state, move('d8', 'd4', 'black'));
    expect(next.pieces.get('d4')).toMatchObject({ type: 'rook', color: 'black' });
  });

  it('interaction: Death And Taxes. Both count the same own moves', () => {
    const state = start([...KINGS(), makePiece('rook', 'white', 'd1')], [{ id: MODIFIER_IDS.deathAndTaxes, sourceColor: 'white' }]);
    const lagged = chessEngine.applyMove({ ...state, ownMoves: { white: LAG_EVERY - 1, black: LAG_EVERY - 1 } }, move('d1', 'd5', 'white'));
    expect(lagged.pieces.get('d1')).toMatchObject({ type: 'rook' });
    expect(lagged.turn).toBe('black');
  });

  it('a lagged pawn move does not reset the 50-move clock', () => {
    let state = start([...KINGS(), makePiece('pawn', 'white', 'b2')]);
    state = { ...state, ownMoves: { white: LAG_EVERY - 1, black: LAG_EVERY - 1 }, flags: { ...state.flags, halfMoveClock: 20 } };
    const next = chessEngine.applyMove(state, move('b2', 'b3', 'white'));
    expect(next.pieces.get('b2')).toMatchObject({ type: 'pawn' });
    expect(next.flags.halfMoveClock).toBe(21);
  });

  it('the feed names a disguised piece as the opponent sees it (Sus)', () => {
    let state = start([...KINGS(), makePiece('pawn', 'white', 'b2')], [{ id: MODIFIER_IDS.sus, sourceColor: 'white' }]);
    state = {
      ...state,
      ownMoves: { white: LAG_EVERY - 1, black: LAG_EVERY - 1 },
      modifierState: { ...state.modifierState, [MODIFIER_IDS.sus]: { white: { pieceId: 'white-pawn-b2', shownAs: 'knight' } } },
    };
    const next = chessEngine.applyMove(state, move('b2', 'b3', 'white'));
    expect(next.eventHistory[next.eventHistory.length - 1].message).toMatch(/White's knight went to b3/);
  });

  it('other cards see the move land first, whatever the draft order (a mine goes off: no snap)', () => {
    for (const order of ['before', 'after'] as const) {
      const mine = { id: MODIFIER_IDS.minesweeper, sourceColor: 'black' as const };
      const picks = order === 'before'
        ? [{ id: ID, sourceColor: 'white' as const }, mine]
        : [mine, { id: ID, sourceColor: 'white' as const }];
      let state = chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState([...KINGS(), makePiece('rook', 'white', 'd1')]), picks));
      state = {
        ...state,
        ownMoves: { white: LAG_EVERY - 1, black: LAG_EVERY - 1 },
        modifierState: { ...state.modifierState, [MODIFIER_IDS.minesweeper]: { mines: ['d4'], clues: [] } },
      };
      const next = chessEngine.applyMove(state, move('d1', 'd4', 'white'));
      expect(next.pieces.get('d1')).toBeUndefined();
      expect(next.pieces.get('d4')).toBeUndefined();
      expect(isLagDue(next, 'white')).toBe(true);
    }
  });
});
