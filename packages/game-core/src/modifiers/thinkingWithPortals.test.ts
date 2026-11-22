import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';

const PORTALS = MODIFIER_IDS.thinkingWithPortals;

function withPortals(pieces: Piece[]): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: PORTALS, sourceColor: 'white' }]);
}

const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')];

describe('MOD-A011 Thinking With Portals', () => {
  it('marks c4 blue and f5 orange', () => {
    const state = withPortals(KINGS());
    expect(state.tiles.get('c4')?.portal).toBe('blue');
    expect(state.tiles.get('f5')?.portal).toBe('orange');
  });

  it('a piece that ends on one portal steps out of the other', () => {
    let state = withPortals([...KINGS(), makePiece('rook', 'white', 'c1')]);
    state = chessEngine.applyMove(state, move('c1', 'c4', 'white'));
    expect(state.pieces.get('c4')).toBeUndefined();
    expect(state.pieces.get('f5')).toMatchObject({ type: 'rook', color: 'white' });
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: PORTALS, title: 'Portal' });
  });

  it('works both ways and after a capture', () => {
    let state = withPortals([...KINGS(), makePiece('bishop', 'black', 'h3'), makePiece('knight', 'white', 'f5'), makePiece('pawn', 'white', 'b2')]);
    state = chessEngine.applyMove(state, move('b2', 'b3', 'white'));
    state = chessEngine.applyMove(state, move('h3', 'f5', 'black'));
    expect(state.pieces.get('f5')).toBeUndefined();
    expect(state.pieces.get('c4')).toMatchObject({ type: 'bishop', color: 'black' });
  });

  it('never captures: an occupied exit leaves the piece on the entry portal', () => {
    let state = withPortals([...KINGS(), makePiece('rook', 'white', 'c1'), makePiece('pawn', 'black', 'f5')]);
    state = chessEngine.applyMove(state, move('c1', 'c4', 'white'));
    expect(state.pieces.get('c4')).toMatchObject({ type: 'rook' });
    expect(state.pieces.get('f5')).toMatchObject({ type: 'pawn', color: 'black' });
  });

  it('Kings do not use portals', () => {
    let state = withPortals([makePiece('king', 'white', 'c3'), makePiece('king', 'black', 'h8')]);
    state = chessEngine.applyMove(state, move('c3', 'c4', 'white'));
    expect(state.pieces.get('c4')).toMatchObject({ type: 'king' });
  });

  it('never jumps into self-check', () => {
    // The knight on c4 would leave the c-file open to the rook on c8.
    let state = withPortals([makePiece('king', 'white', 'c1'), makePiece('rook', 'black', 'c8'), makePiece('king', 'black', 'h8'), makePiece('knight', 'white', 'b2')]);
    state = chessEngine.applyMove(state, move('b2', 'c4', 'white'));
    expect(state.pieces.get('c4')).toMatchObject({ type: 'knight' });
    expect(state.pieces.get('f5')).toBeUndefined();
  });

  it('a pawn that double-steps through a portal cannot be taken en passant', () => {
    let state = withPortals([...KINGS(), makePiece('pawn', 'white', 'c2'), makePiece('pawn', 'black', 'd4')]);
    state = chessEngine.applyMove(state, move('c2', 'c4', 'white'));
    expect(state.pieces.get('f5')).toMatchObject({ type: 'pawn', color: 'white' });
    expect(state.flags.enPassantSquare).toBeNull();
  });

  it('only one of Portals, Vent Tiles and The Birds per match, whoever drafts it (interaction)', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    const ids = (cards: { id: string }[]) => cards.map(c => c.id);
    expect(ids(getValidOptions([], [PORTALS], built))).not.toContain(MODIFIER_IDS.ventTiles);
    expect(ids(getValidOptions([], [PORTALS], built))).not.toContain(MODIFIER_IDS.theBirds);
    expect(ids(getValidOptions([MODIFIER_IDS.theBirds], [], built))).not.toContain(PORTALS);
    const card = ALL_MODIFIERS.find(c => c.id === PORTALS)!;
    expect(pickBlocker(card, [], [MODIFIER_IDS.ventTiles], built)).toMatch(/Vent Tiles/);
  });
});
