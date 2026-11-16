import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { SWAP_COOLDOWN } from './definitions/freaky-friday';
import { makeEmptyState, makePiece, move } from './testHelpers';

const SWAP = MODIFIER_IDS.freakyFriday;

function withSwap(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: SWAP, sourceColor: 'white' }, ...extra]);
}

function swapTargets(state: GameState, square: Square): Square[] {
  return [...(getAbilityOptions(state, square).find(option => option.modifierId === SWAP)?.targets ?? [])].sort();
}

describe('MOD-C012 Freaky Friday', () => {
  it('swaps two adjacent friendly pieces', () => {
    const state = withSwap([
      makePiece('king', 'white', 'e1'),
      makePiece('knight', 'white', 'c3'),
      makePiece('bishop', 'white', 'd4'),
      makePiece('rook', 'black', 'b4'),
      makePiece('king', 'black', 'h8'),
    ]);
    // Only own pieces, not the enemy rook beside it.
    expect(swapTargets(state, 'c3')).toEqual(['d4']);

    const next = chessEngine.applyMove(state, move('c3', 'd4', 'white', { ability: SWAP }));
    expect(next.pieces.get('d4')).toMatchObject({ type: 'knight', color: 'white', square: 'd4' });
    expect(next.pieces.get('c3')).toMatchObject({ type: 'bishop', color: 'white', square: 'c3' });
    expect(next.pieces.get('b4')).toMatchObject({ type: 'rook', color: 'black' });
    expect(next.turn).toBe('black');
    expect(next.moveHistory[0].notation).toBe('c3⇄d4');
    expect(next.eventHistory[next.eventHistory.length - 1]).toMatchObject({ modifierId: SWAP, title: 'FREAKY FRIDAY' });
  });

  it('never swaps the King', () => {
    const state = withSwap([
      makePiece('king', 'white', 'e1'),
      makePiece('queen', 'white', 'd1'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(swapTargets(state, 'd1')).toEqual([]);
    expect(getAbilityOptions(state, 'e1').some(o => o.modifierId === SWAP)).toBe(false);
    expect(chessEngine.validateMove(state, move('d1', 'e1', 'white', { ability: SWAP })).valid).toBe(false);
  });

  it('never puts a pawn on rank 1 or 8', () => {
    const state = withSwap([
      makePiece('king', 'white', 'h1'),
      makePiece('pawn', 'white', 'b2'),
      makePiece('rook', 'white', 'a1'),
      makePiece('knight', 'white', 'c3'),
      makePiece('pawn', 'white', 'f7'),
      makePiece('bishop', 'white', 'g8'),
      makePiece('king', 'black', 'a8'),
    ]);
    expect(swapTargets(state, 'b2')).toEqual(['c3']);
    expect(swapTargets(state, 'a1')).toEqual([]);
    expect(swapTargets(state, 'f7')).toEqual([]);
  });

  it('may not leave the King in check', () => {
    // A swap keeps the same squares filled, so it never answers a check.
    const state = withSwap([
      makePiece('king', 'white', 'e1'),
      makePiece('knight', 'white', 'd2'),
      makePiece('rook', 'white', 'd3'),
      makePiece('rook', 'black', 'a1'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(swapTargets(state, 'd2')).toEqual([]);
    expect(chessEngine.validateMove(state, move('d2', 'd3', 'white', { ability: SWAP })).valid).toBe(false);
  });

  it('cannot swap a piece Gerald is holding', () => {
    const state = withSwap(
      [
        makePiece('king', 'white', 'h1'),
        makePiece('knight', 'white', 'c3'),
        makePiece('bishop', 'white', 'd4'),
        makePiece('king', 'black', 'h8'),
      ],
      [{ id: MODIFIER_IDS.gerald, sourceColor: 'white' }],
    );
    for (const p of state.pieces.values()) p.cooldowns = {};
    expect(swapTargets(state, 'c3')).toEqual(['d4']);
    const bishop = state.pieces.get('d4')!;
    state.pieces.set('d4', { ...bishop, cooldowns: { [MODIFIER_IDS.gerald]: 2 } });
    expect(swapTargets(state, 'c3')).toEqual([]);
    expect(swapTargets(state, 'd4')).toEqual([]);
  });

  it('makes both pieces wait 7 own turns', () => {
    let state = withSwap([
      makePiece('king', 'white', 'h1'),
      makePiece('knight', 'white', 'c3'),
      makePiece('bishop', 'white', 'd4'),
      makePiece('rook', 'white', 'e4'),
      makePiece('king', 'black', 'a8'),
    ]);
    state = chessEngine.applyMove(state, move('c3', 'd4', 'white', { ability: SWAP }));
    expect(state.pieces.get('d4')?.abilityCooldowns?.[SWAP]).toBe(SWAP_COOLDOWN);
    expect(state.pieces.get('c3')?.abilityCooldowns?.[SWAP]).toBe(SWAP_COOLDOWN);
    // The rook cannot swap with the cooling knight either.
    state = chessEngine.applyMove(state, move('a8', 'b8', 'black'));
    expect(swapTargets(state, 'e4')).toEqual([]);
    for (let turn = 1; turn < SWAP_COOLDOWN; turn++) {
      state.positionHistory = {};
      state = chessEngine.applyMove(state, move(turn % 2 ? 'h1' : 'h2', turn % 2 ? 'h2' : 'h1', 'white'));
      state = chessEngine.applyMove(state, move(turn % 2 ? 'b8' : 'a8', turn % 2 ? 'a8' : 'b8', 'black'));
      expect(swapTargets(state, 'c3')).toEqual([]);
    }
    state.positionHistory = {};
    state = chessEngine.applyMove(state, move('h2', 'h1', 'white'));
    state = chessEngine.applyMove(state, move('b8', 'a8', 'black'));
    expect(swapTargets(state, 'c3')).toEqual(['d4']);
    expect(swapTargets(state, 'e4')).toEqual(['d4']);
  });

  it('is only offered to the owner', () => {
    const state = withSwap([
      makePiece('king', 'white', 'h1'),
      makePiece('knight', 'black', 'c6'),
      makePiece('bishop', 'black', 'd5'),
      makePiece('king', 'black', 'a8'),
    ]);
    state.turn = 'black';
    expect(getAbilityOptions(state, 'c6')).toEqual([]);
    expect(chessEngine.validateMove(state, move('c6', 'd5', 'black', { ability: SWAP })).valid).toBe(false);
  });
});
