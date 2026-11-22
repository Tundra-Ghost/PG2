import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { SEAGULL_EVERY, getSeagullTarget } from './definitions/mine';
import { getValidOptions } from '../draft/rules';
import { makeEmptyState, makePiece, move } from './testHelpers';

const MINE = MODIFIER_IDS.mine;

function withMine(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' | null }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: MINE, sourceColor: 'white' }, ...extra]);
}

/** Kings shuffle (white a1/a2, black h8/h7) until White has made `n` moves; the last one is White's. */
function playWhiteMoves(state: GameState, n: number): GameState {
  const steps: Record<string, Square> = { a1: 'b1', b1: 'a1', h8: 'g8', g8: 'h8' };
  let white = 0;
  while (white < n) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn)!;
    if (state.turn === 'white') white++;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

describe('MOD-B017 MINE!', () => {
  it('carries the most advanced pawn one square back after every 8th move', () => {
    let state = withMine([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'd5'),
      makePiece('pawn', 'white', 'f3'),
      makePiece('king', 'black', 'h8'),
    ]);
    state = playWhiteMoves(state, SEAGULL_EVERY - 1);
    expect(state.pieces.get('d5')).toBeDefined();
    state = playWhiteMoves(state, 1);
    expect(state.pieces.get('d5')).toBeUndefined();
    expect(state.pieces.get('d4')).toMatchObject({ type: 'pawn', color: 'white' });
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: MINE, title: 'MINE!' });
    // The next seagull comes 8 moves later.
    state = playWhiteMoves(state, SEAGULL_EVERY);
    expect(state.pieces.get('d3')).toMatchObject({ type: 'pawn' });
  });

  it('clears en passant when it carries a pawn that just double-stepped', () => {
    let state = withMine([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'e2'),
      makePiece('pawn', 'black', 'd4'),
      makePiece('king', 'black', 'h8'),
    ]);
    state = playWhiteMoves(state, SEAGULL_EVERY - 1);
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('h8', 'g8', 'black'));
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('e2', 'e4', 'white'));
    expect(state.pieces.get('e3')).toMatchObject({ type: 'pawn', color: 'white' });
    expect(state.flags.enPassantSquare).toBeNull();
  });

  it('never gives a Sus disguise away', () => {
    const base = [
      makePiece('king', 'white', 'a1'),
      makePiece('knight', 'white', 'd6', 'fake-pawn'),
      makePiece('pawn', 'white', 'e5', 'real-pawn'),
      makePiece('pawn', 'white', 'f4', 'hidden-pawn'),
      makePiece('king', 'black', 'h8'),
    ];
    // The knight on d6 is shown to Black as a pawn: it leads, so the seagull does nothing.
    const fake = withMine(base);
    fake.modifierState = { ...fake.modifierState, [MODIFIER_IDS.sus]: { white: { pieceId: 'fake-pawn', shownAs: 'pawn' } } };
    expect(getSeagullTarget(fake, 'white')).toBeNull();
    // The pawn on e5 is shown as a knight: the seagull skips it and takes f4.
    const hidden = withMine(base.filter(p => p.id !== 'fake-pawn'));
    hidden.modifierState = { ...hidden.modifierState, [MODIFIER_IDS.sus]: { white: { pieceId: 'real-pawn', shownAs: 'knight' } } };
    expect(getSeagullTarget(hidden, 'white')).toEqual({ from: 'f4', to: 'f3' });
  });

  it('a seagull due on a pass comes on the next real move', () => {
    let state = withMine([makePiece('king', 'white', 'a1'), makePiece('pawn', 'white', 'd5'), makePiece('rook', 'white', 'h1'), makePiece('king', 'black', 'h8')]);
    state = playWhiteMoves(state, SEAGULL_EVERY - 1);
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('h8', 'g8', 'black'));
    state = chessEngine.passTurn(state);
    expect(state.turn).toBe('black');
    expect(state.pieces.get('d5')).toBeDefined();
    expect(state.eventHistory.some(e => e.modifierId === MINE)).toBe(false);
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('g8', 'h8', 'black'));
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move('h1', 'h2', 'white'));
    expect(state.pieces.get('d4')).toMatchObject({ type: 'pawn' });
    // Only once: the next one is due after move 16.
    state = playWhiteMoves(state, 1);
    expect(state.eventHistory.filter(e => e.modifierId === MINE)).toHaveLength(1);
  });

  it('moves black pawns up the board', () => {
    const state = withMine([makePiece('king', 'black', 'h8'), makePiece('pawn', 'black', 'c4'), makePiece('king', 'white', 'a1')]);
    expect(getSeagullTarget(state, 'black')).toEqual({ from: 'c4', to: 'c5' });
  });

  it('does nothing if the square behind is taken, or is the back rank', () => {
    const blocked = withMine([makePiece('king', 'white', 'a1'), makePiece('pawn', 'white', 'd5'), makePiece('knight', 'white', 'd4'), makePiece('king', 'black', 'h8')]);
    expect(getSeagullTarget(blocked, 'white')).toBeNull();
    const home = withMine([makePiece('king', 'white', 'a1'), makePiece('pawn', 'white', 'd2'), makePiece('king', 'black', 'h8')]);
    expect(getSeagullTarget(home, 'white')).toBeNull();
  });

  it('never exposes its own King', () => {
    // The pawn on d4 shields the King on a4 from the rook on h4.
    const pinned = withMine([
      makePiece('king', 'white', 'a4'),
      makePiece('pawn', 'white', 'd4'),
      makePiece('rook', 'black', 'h4'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(getSeagullTarget(pinned, 'white')).toBeNull();
  });

  it('never lands a pawn on a Dirt Hut wall (interaction)', () => {
    let state = withMine(
      [makePiece('king', 'white', 'a1'), makePiece('rook', 'white', 'c4'), makePiece('pawn', 'white', 'd6'), makePiece('king', 'black', 'h8')],
      [{ id: MODIFIER_IDS.dirtHut, sourceColor: 'white' }],
    );
    state = chessEngine.applyMove(state, move('c4', 'd5', 'white', { ability: MODIFIER_IDS.dirtHut }));
    expect(getSeagullTarget(state, 'white')).toBeNull();
  });

  it('cannot be drafted with The Small Council', () => {
    const ids = getValidOptions([MODIFIER_IDS.smallCouncil], [], new Set([MINE, MODIFIER_IDS.smallCouncil])).map(o => o.id);
    expect(ids).not.toContain(MINE);
  });
});
