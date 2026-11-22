import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import { validateMove } from '../engine/moveValidator';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { PULL_COOLDOWN } from './definitions/get-over-here';
import { makeEmptyState, makePiece, move } from './testHelpers';

const PULL = MODIFIER_IDS.getOverHere;

function withPull(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: PULL, sourceColor: 'white' }, ...extra]);
}

function targets(state: GameState, square: Square): Square[] {
  return (getAbilityOptions(state, square).find(option => option.modifierId === PULL)?.targets ?? []).sort();
}

describe('MOD-C011 GET OVER HERE!', () => {
  it('pulls the first enemy piece on a line to the square next to the Queen', () => {
    const state = withPull([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd4'),
      makePiece('rook', 'black', 'd8'),
      makePiece('bishop', 'black', 'g7'),
      makePiece('knight', 'black', 'h8'), // behind the bishop: not first
      makePiece('pawn', 'white', 'b4'),
      makePiece('knight', 'black', 'a4'), // behind an own piece: not first
      makePiece('king', 'black', 'h1'),
    ]);
    expect(targets(state, 'd4')).toEqual(['d8', 'g7']);
    const next = chessEngine.applyMove(state, move('d4', 'd8', 'white', { ability: PULL }));
    expect(next.pieces.get('d5')).toMatchObject({ type: 'rook', color: 'black' });
    expect(next.pieces.has('d8')).toBe(false);
    expect(next.pieces.get('d4')).toMatchObject({ type: 'queen', color: 'white' });
    expect(next.pieces.get('d4')!.abilityCooldowns?.[PULL]).toBe(PULL_COOLDOWN);
    expect(next.turn).toBe('black');
  });

  it('never pulls a King or a piece already next to her', () => {
    const state = withPull([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd2'),
      makePiece('king', 'black', 'd7'),
      makePiece('knight', 'black', 'e3'), // already next to her
      makePiece('pawn', 'black', 'f2'), // lands on e2
      makePiece('pawn', 'black', 'b4'), // lands on c3
    ]);
    expect(targets(state, 'd2')).toEqual(['b4', 'f2']);
  });

  it('never pulls a pawn onto rank 1 or 8', () => {
    // The Queen on d1: a black pawn on g1 would land on e1.
    const state = withPull([
      makePiece('king', 'white', 'a3'),
      makePiece('queen', 'white', 'd1'),
      makePiece('pawn', 'black', 'g1'),
      makePiece('rook', 'black', 'g4'), // lands on e2: fine
      makePiece('king', 'black', 'h8'),
    ]);
    expect(targets(state, 'd1')).toEqual(['g4']);
  });

  it('may not leave your own King in check', () => {
    // The bishop on e5 blocks the black Queen on h8 from the white King on a1.
    const state = withPull([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'e2'),
      makePiece('bishop', 'black', 'e5'),
      makePiece('queen', 'black', 'h8'),
      makePiece('king', 'black', 'a8'),
    ]);
    // Pulling the bishop from e5 to e3 opens h8-a1.
    expect(validateMove(state, move('e2', 'e5', 'white', { ability: PULL })).valid).toBe(false);
    expect(targets(state, 'e2')).toEqual([]);
  });

  it('stops at void squares and never lands on Lava', () => {
    const state = withPull([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd4'),
      makePiece('rook', 'black', 'd8'),
      makePiece('rook', 'black', 'h4'),
      makePiece('king', 'black', 'a8'),
    ]);
    state.tiles.set('d6', { square: 'd6', effects: [], isVoid: true });
    state.tiles.set('e4', { square: 'e4', effects: [{ type: 'lava', turnsRemaining: -1 }] });
    expect(targets(state, 'd4')).toEqual([]);
  });

  it('under fog, only pulls along lines it can fully see', () => {
    const state = withPull(
      [
        makePiece('king', 'white', 'a1'),
        makePiece('queen', 'white', 'a4'),
        makePiece('rook', 'black', 'h4'),
        makePiece('knight', 'black', 'a6'),
        makePiece('king', 'black', 'h8'),
      ],
      [{ id: MODIFIER_IDS.darkAndScared, sourceColor: 'white' }],
    );
    // Vision is 2 squares: a6 is in view, h4 is not.
    expect(targets(state, 'a4')).toEqual(['a6']);
  });

  it('only works for its owner', () => {
    const state = withPull([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'black', 'd4'),
      makePiece('rook', 'white', 'd8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(targets({ ...state, turn: 'black' }, 'd4')).toEqual([]);
  });

  it('acts from a distance: Quiet Quitting only stops pulls into a zone', () => {
    const base = [
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd4'),
      makePiece('rook', 'black', 'd8'),
      makePiece('king', 'black', 'h1'),
    ];
    // A black zone around e8 covers d8: White may still pull the rook out.
    const black = withPull([...base, makePiece('queen', 'black', 'e8')]);
    black.modifierState[MODIFIER_IDS.quietQuitting] = [{ queenId: 'black-queen-e8', color: 'black', center: 'e8', turnsLeft: 2 }];
    black.activeModifiers.push({ id: MODIFIER_IDS.quietQuitting, name: 'Quiet Quitting', activeFor: 'black', sourceColor: 'black' });
    expect(targets(black, 'd4')).toContain('d8');
    // A white zone around c6 covers d5: the rook may not be pulled into it.
    const white = withPull([...base, makePiece('rook', 'white', 'c6')]);
    white.modifierState[MODIFIER_IDS.quietQuitting] = [{ queenId: 'white-rook-c6', color: 'white', center: 'c6', turnsLeft: 2 }];
    expect(targets(white, 'd4')).not.toContain('d8');
  });

  it('under Sus, the pawn rule follows what the Queen owner sees', () => {
    const state = withPull([
      makePiece('king', 'white', 'a3'),
      makePiece('queen', 'white', 'd1'),
      makePiece('pawn', 'black', 'g1'), // really a pawn, shown as a rook
      makePiece('king', 'black', 'h8'),
    ]);
    state.modifierState[MODIFIER_IDS.sus] = { black: { pieceId: 'black-pawn-g1', shownAs: 'rook' } };
    state.activeModifiers.push({ id: MODIFIER_IDS.sus, name: 'Sus', activeFor: 'black', sourceColor: 'black' });
    expect(targets(state, 'd1')).toEqual(['g1']);
  });
});
