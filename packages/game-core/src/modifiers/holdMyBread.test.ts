import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import { validateMove } from '../engine/moveValidator';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { BREAD_COOLDOWN } from './definitions/hold-my-bread';
import { makeEmptyState, makePiece, move } from './testHelpers';

const BREAD = MODIFIER_IDS.holdMyBread;

function withBread(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: BREAD, sourceColor: 'white' }, ...extra]);
}

function targets(state: GameState, square: Square): Square[] {
  return (getAbilityOptions(state, square).find(option => option.modifierId === BREAD)?.targets ?? []).sort();
}

const shield = (state: GameState, from: Square, to: Square) =>
  chessEngine.applyMove(state, move(from, to, 'white', { ability: BREAD }));

describe('MOD-C013 Hold My Bread', () => {
  it('shields a neighbouring friend for exactly one enemy move', () => {
    const state = withBread([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'd4'),
      makePiece('bishop', 'white', 'e5'),
      makePiece('knight', 'white', 'c4'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(targets(state, 'd4')).toEqual(['c4', 'e5']);
    const shielded = shield(state, 'd4', 'e5');
    expect(shielded.pieces.get('e5')!.isShielded).toBe(true);
    expect(shielded.pieces.get('d4')!.abilityCooldowns?.[BREAD]).toBe(BREAD_COOLDOWN);
    expect(shielded.turn).toBe('black');
    // Black cannot take the bishop this move.
    expect(validateMove(shielded, move('e8', 'e5', 'black')).valid).toBe(false);
    // After Black's move and White's reply, the bishop can be taken again.
    const afterBlack = chessEngine.applyMove(shielded, move('h8', 'g8', 'black'));
    expect(afterBlack.pieces.get('e5')!.isShielded).toBe(false);
    const afterWhite = chessEngine.applyMove(afterBlack, move('a1', 'a2', 'white'));
    expect(validateMove(afterWhite, move('e8', 'e5', 'black')).valid).toBe(true);
  });

  it('cannot shield the King, and is not allowed in check', () => {
    const state = withBread([
      makePiece('king', 'white', 'e3'),
      makePiece('pawn', 'white', 'd4'),
      makePiece('rook', 'black', 'h8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(targets(state, 'd4')).toEqual([]);
    const check = withBread([
      makePiece('king', 'white', 'e1'),
      makePiece('pawn', 'white', 'd4'),
      makePiece('knight', 'white', 'c4'),
      makePiece('rook', 'black', 'e8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(targets(check, 'd4')).toEqual([]);
  });

  it('stops en passant on a shielded pawn', () => {
    const state = withBread([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'd2'),
      makePiece('pawn', 'black', 'e4'),
      makePiece('king', 'black', 'h8'),
    ]);
    const moved = chessEngine.applyMove(state, move('d2', 'd4', 'white'));
    expect(validateMove(moved, move('e4', 'd3', 'black')).valid).toBe(true);
    // The same position with the d-pawn under a White shield.
    const guarded = { ...moved, modifierState: { ...moved.modifierState, [BREAD]: [{ pieceId: 'white-pawn-d2', color: 'white' }] } };
    expect(validateMove(guarded, move('e4', 'd3', 'black')).valid).toBe(false);
  });

  it('stops abilities that would remove the piece (FOR THE EMPEROR)', () => {
    const state = withBread(
      [
        makePiece('king', 'white', 'a1'),
        makePiece('pawn', 'white', 'd4'),
        makePiece('knight', 'white', 'd5'),
        makePiece('rook', 'black', 'd8'),
        makePiece('king', 'black', 'h8'),
      ],
      [{ id: MODIFIER_IDS.forTheEmperor, sourceColor: 'black' }],
    );
    const shielded = shield(state, 'd4', 'd5');
    const shot = getAbilityOptions(shielded, 'd8').find(o => o.modifierId === MODIFIER_IDS.forTheEmperor);
    expect(shot?.targets ?? []).not.toContain('d5');
  });

  it('only works for its owner', () => {
    const state = withBread([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'black', 'd5'),
      makePiece('bishop', 'black', 'e6'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(targets({ ...state, turn: 'black' }, 'd5')).toEqual([]);
  });
});
