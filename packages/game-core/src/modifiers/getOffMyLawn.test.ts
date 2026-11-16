import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { LAWN_COOLDOWN } from './definitions/get-off-my-lawn';
import { makeEmptyState, makePiece, move } from './testHelpers';

const LAWN = MODIFIER_IDS.getOffMyLawn;

function withLawn(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: LAWN, sourceColor: 'white' }, ...extra]);
}

function lawnTargets(state: GameState, square: Square): Square[] {
  return getAbilityOptions(state, square).find(option => option.modifierId === LAWN)?.targets ?? [];
}

describe('MOD-C017 Get Off My Lawn', () => {
  it('pushes every enemy pawn next to the King one square back', () => {
    const state = withLawn([
      makePiece('king', 'white', 'e4'),
      makePiece('pawn', 'black', 'd5'),
      makePiece('pawn', 'black', 'f4'),
      makePiece('pawn', 'black', 'e3'),
      makePiece('knight', 'black', 'f5'),
      makePiece('pawn', 'white', 'd3'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(lawnTargets(state, 'e4')).toEqual(['e4']);

    const next = chessEngine.applyMove(state, move('e4', 'e4', 'white', { ability: LAWN }));
    expect(next.pieces.get('d6')).toMatchObject({ type: 'pawn', color: 'black' });
    expect(next.pieces.get('f5')).toMatchObject({ type: 'knight' });
    // f4 is blocked by the knight on f5, and e3 by the King itself.
    expect(next.pieces.get('f4')).toMatchObject({ type: 'pawn', color: 'black' });
    expect(next.pieces.get('e3')).toMatchObject({ type: 'pawn', color: 'black' });
    // Own pawns stay.
    expect(next.pieces.get('d3')).toMatchObject({ type: 'pawn', color: 'white' });
    expect(next.pieces.get('e4')).toMatchObject({ type: 'king', color: 'white' });
    expect(next.turn).toBe('black');
    expect(next.moveHistory[0].notation).toBe('Ke4 lawn');
    expect(next.eventHistory[next.eventHistory.length - 1]).toMatchObject({ modifierId: LAWN, title: 'GET OFF MY LAWN' });
  });

  it('pushes white pawns down the board for a black King', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([makePiece('king', 'black', 'e5'), makePiece('pawn', 'white', 'd4'), makePiece('king', 'white', 'h1')]),
      [{ id: LAWN, sourceColor: 'black' }],
    );
    state.turn = 'black';
    const next = chessEngine.applyMove(state, move('e5', 'e5', 'black', { ability: LAWN }));
    expect(next.pieces.get('d3')).toMatchObject({ type: 'pawn', color: 'white' });
  });

  it('is not offered when no pawn can move', () => {
    const state = withLawn([
      makePiece('king', 'white', 'e4'),
      makePiece('pawn', 'black', 'f4'),
      makePiece('knight', 'black', 'f5'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(lawnTargets(state, 'e4')).toEqual([]);
    expect(chessEngine.validateMove(state, move('e4', 'e4', 'white', { ability: LAWN })).valid).toBe(false);
  });

  it('is allowed in check only when the push ends it', () => {
    // The pawn on d5 checks the King on e4; pushing it to d6 ends the check.
    const ends = withLawn([
      makePiece('king', 'white', 'e4'),
      makePiece('pawn', 'black', 'd5'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(chessEngine.isInCheck(ends, 'white')).toBe(true);
    expect(lawnTargets(ends, 'e4')).toEqual(['e4']);

    // A rook checks too, so the push alone does not help.
    const stays = withLawn([
      makePiece('king', 'white', 'e4'),
      makePiece('pawn', 'black', 'd5'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(lawnTargets(stays, 'e4')).toEqual([]);
  });

  it('never pushes a pawn onto Lava or a storm square', () => {
    const state = withLawn([
      makePiece('king', 'white', 'e4'),
      makePiece('pawn', 'black', 'd5'),
      makePiece('pawn', 'black', 'f5'),
      makePiece('king', 'black', 'a8'),
    ]);
    state.tiles.set('d6', { square: 'd6', effects: [{ type: 'lava', turnsRemaining: -1 }] });
    state.tiles.set('f6', { square: 'f6', effects: [], isVoid: true });
    expect(lawnTargets(state, 'e4')).toEqual([]);
  });

  it('waits 8 own turns', () => {
    let state = withLawn([
      makePiece('king', 'white', 'e4'),
      makePiece('pawn', 'black', 'd5'),
      makePiece('rook', 'white', 'h1'),
      makePiece('king', 'black', 'a8'),
    ]);
    state = chessEngine.applyMove(state, move('e4', 'e4', 'white', { ability: LAWN }));
    for (let turn = 1; turn <= LAWN_COOLDOWN; turn++) {
      state.positionHistory = {};
      state = chessEngine.applyMove(state, move(turn % 2 ? 'a8' : 'b8', turn % 2 ? 'b8' : 'a8', 'black'));
      expect(getAbilityOptions(state, 'e4').find(o => o.modifierId === LAWN)?.cooldownLeft).toBeGreaterThan(0);
      state = chessEngine.applyMove(state, move(turn % 2 ? 'h1' : 'h2', turn % 2 ? 'h2' : 'h1', 'white'));
    }
    state = chessEngine.applyMove(state, move('a8', 'b8', 'black'));
    expect(getAbilityOptions(state, 'e4').find(o => o.modifierId === LAWN)?.cooldownLeft).toBe(0);
  });

  it('is only offered to the owner', () => {
    const state = withLawn([
      makePiece('king', 'white', 'h1'),
      makePiece('king', 'black', 'e5'),
      makePiece('pawn', 'white', 'd4'),
    ]);
    state.turn = 'black';
    expect(getAbilityOptions(state, 'e5')).toEqual([]);
  });

  it('sees pawns the way the owner sees them under Sus', () => {
    const state = withLawn([
      makePiece('king', 'white', 'e4'),
      makePiece('knight', 'black', 'd5', 'fake-pawn'),
      makePiece('king', 'black', 'a8'),
    ], [{ id: MODIFIER_IDS.sus, sourceColor: 'black' }]);
    state.modifierState[MODIFIER_IDS.sus] = { black: { pieceId: 'fake-pawn', shownAs: 'pawn' } };
    const next = chessEngine.applyMove(state, move('e4', 'e4', 'white', { ability: LAWN }));
    expect(next.pieces.get('d6')).toMatchObject({ type: 'knight', color: 'black' });
  });
});
