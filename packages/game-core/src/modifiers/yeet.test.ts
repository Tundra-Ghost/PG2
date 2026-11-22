import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import { validateMove } from '../engine/moveValidator';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { YEET_COOLDOWN } from './definitions/yeet';
import { makeEmptyState, makePiece, move } from './testHelpers';

const YEET = MODIFIER_IDS.yeet;

function withYeet(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: YEET, sourceColor: 'white' }, ...extra]);
}

function targets(state: GameState, square: Square): Square[] {
  return getAbilityOptions(state, square).find(option => option.modifierId === YEET)?.targets ?? [];
}

describe('MOD-C009 YEET', () => {
  it('shoves an adjacent enemy piece one square straight away; the rook stays', () => {
    const state = withYeet([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd4'),
      makePiece('bishop', 'black', 'e4'),
      makePiece('knight', 'black', 'd5'),
      makePiece('pawn', 'black', 'e5'), // diagonal: not a target
      makePiece('king', 'black', 'h8'),
    ]);
    expect(targets(state, 'd4').sort()).toEqual(['d5', 'e4']);
    const next = chessEngine.applyMove(state, move('d4', 'e4', 'white', { ability: YEET }));
    expect(next.pieces.get('f4')).toMatchObject({ type: 'bishop', color: 'black' });
    expect(next.pieces.has('e4')).toBe(false);
    expect(next.pieces.get('d4')).toMatchObject({ type: 'rook', color: 'white' });
    expect(next.pieces.get('d4')!.abilityCooldowns?.[YEET]).toBe(YEET_COOLDOWN);
    expect(next.turn).toBe('black');
  });

  it('never shoves a King, off the board, or onto a piece', () => {
    const state = withYeet([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'g4'),
      makePiece('knight', 'black', 'h4'), // edge: nowhere to go
      makePiece('bishop', 'black', 'g5'),
      makePiece('pawn', 'white', 'g6'), // blocks the bishop
      makePiece('king', 'black', 'f4'),
    ]);
    expect(targets(state, 'g4')).toEqual([]);
  });

  it('is refused when the shove leaves your King in check', () => {
    // The black bishop on c2 blocks the black rook on h2 from the white King on a2.
    const state = withYeet([
      makePiece('king', 'white', 'a2'),
      makePiece('rook', 'white', 'c3'),
      makePiece('bishop', 'black', 'c2'),
      makePiece('rook', 'black', 'h2'),
      makePiece('king', 'black', 'h8'),
    ]);
    // Shoving the bishop from c2 to c1 opens the line to a2.
    expect(validateMove(state, move('c3', 'c2', 'white', { ability: YEET })).valid).toBe(false);
    expect(targets(state, 'c3')).toEqual([]);
  });

  it('is not allowed in check unless the shove ends it', () => {
    const state = withYeet([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd4'),
      makePiece('knight', 'black', 'd5'),
      makePiece('rook', 'black', 'a8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(targets(state, 'd4')).toEqual([]);
  });

  it('shoves onto Lava, which burns the piece (synergy)', () => {
    const state = withYeet(
      [
        makePiece('king', 'white', 'a1'),
        makePiece('rook', 'white', 'd4'),
        makePiece('bishop', 'black', 'e4'),
        makePiece('king', 'black', 'h8'),
      ],
      [{ id: MODIFIER_IDS.floorIsLava, sourceColor: 'white' }],
    );
    // Place lava by hand on f4 so the test does not depend on random squares.
    for (const [sq, tile] of state.tiles) state.tiles.set(sq, { ...tile, effects: tile.effects.filter(e => e.type !== 'lava') });
    state.tiles.set('f4', { square: 'f4', effects: [{ type: 'lava', turnsRemaining: -1 }] });
    expect(targets(state, 'd4')).toEqual(['e4']);
    const next = chessEngine.applyMove(state, move('d4', 'e4', 'white', { ability: YEET }));
    expect(next.pieces.has('f4')).toBe(false);
    expect(next.pieces.has('e4')).toBe(false);
  });

  it('never shoves a pawn onto rank 1 or 8, and only owns its side', () => {
    const state = withYeet([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd3'),
      makePiece('pawn', 'black', 'd2'),
      makePiece('rook', 'black', 'e6'),
      makePiece('pawn', 'white', 'e7'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(targets(state, 'd3')).toEqual([]);
    // Black did not draft YEET.
    const black = { ...state, turn: 'black' as const };
    expect(targets(black, 'e6')).toEqual([]);
  });
});
