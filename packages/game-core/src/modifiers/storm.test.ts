import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { stormClosesInDef, stormWave } from './definitions/storm-closes-in';
import { makeEmptyState, makePiece, move } from './testHelpers';

const storm = { id: MODIFIER_IDS.stormClosesIn, name: 'The Storm Closes In', activeFor: 'both' as const, sourceColor: null };

/** Pretend `plies` moves have already been played, so the next one is plies + 1. */
function atPly(state: GameState, plies: number): GameState {
  state.activeModifiers = [storm];
  state.moveHistory = Array.from({ length: plies }, () => ({
    move: move('a2', 'a3', 'white'),
    pieceMoved: makePiece('pawn', 'white', 'a2'),
    notation: 'a3',
  }));
  return state;
}

const postMove = (state: GameState) => stormClosesInDef.onPostMove!(state, move('a1', 'a1', 'white'));

describe('The Storm Closes In', () => {
  it('eats the ring from the corners inward in four waves', () => {
    expect(stormWave('a1')).toBe(1);
    expect(stormWave('h8')).toBe(1);
    expect(stormWave('b1')).toBe(2);
    expect(stormWave('a7')).toBe(2);
    expect(stormWave('c8')).toBe(3);
    expect(stormWave('d1')).toBe(4);
    expect(stormWave('h5')).toBe(4);
    expect(stormWave('b2')).toBeNull();
    expect(stormWave('e4')).toBeNull();
  });

  it('warns before a wave, then consumes the squares and the pieces on them', () => {
    const base = () => makeEmptyState([
      makePiece('king', 'white', 'e2'),
      makePiece('rook', 'white', 'a1'),
      makePiece('king', 'black', 'e7'),
    ]);

    const calm = postMove(atPly(base(), 10));
    expect(calm.tiles.get('a1')?.storm).toBeUndefined();

    const warned = postMove(atPly(base(), 11));
    expect(warned.tiles.get('a1')?.storm).toBe('warning');
    expect(warned.pieces.has('a1')).toBe(true);

    const hit = postMove(atPly(base(), 15));
    expect(hit.tiles.get('a1')).toMatchObject({ storm: 'active', isVoid: true });
    expect(hit.tiles.get('h8')?.storm).toBe('active');
    expect(hit.tiles.get('b1')?.storm).toBeUndefined();
    expect(hit.pieces.has('a1')).toBe(false);
    const event = hit.eventHistory.find(e => e.modifierId === MODIFIER_IDS.stormClosesIn);
    expect(event?.squares).toHaveLength(4);
    expect(event?.ply).toBe(16);
  });

  it('spares a king, and takes its square once it leaves', () => {
    const state = atPly(makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'e7'),
    ]), 15);

    const hit = postMove(state);
    expect(hit.pieces.get('a1')?.type).toBe('king');
    expect(hit.tiles.get('a1')?.storm).not.toBe('active');

    hit.pieces.delete('a1');
    hit.pieces.set('b2', makePiece('king', 'white', 'b2'));
    const later = postMove(hit);
    expect(later.tiles.get('a1')?.storm).toBe('active');
  });

  it('storm squares block lines, so a consumed blocker still shields the king', () => {
    const state = atPly(makeEmptyState([
      makePiece('king', 'white', 'a2'),
      makePiece('knight', 'white', 'a3'),
      makePiece('rook', 'white', 'b1'),
      makePiece('queen', 'black', 'a4'),
      makePiece('king', 'black', 'e7'),
    ]), 47);

    const hit = postMove(state);
    // Waves 1-3 are due. The knight on a3 is lost, but the storm there still
    // blocks the queen on a4, so white is not left in check.
    expect(hit.pieces.has('b1')).toBe(false);
    expect(hit.pieces.has('a3')).toBe(false);
    expect(hit.tiles.get('a3')?.storm).toBe('active');
    expect(chessEngine.isInCheck(hit, 'white')).toBe(false);
  });

  it('blocks moves into the storm through the normal rules', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e2'),
      makePiece('rook', 'white', 'd4'),
      makePiece('king', 'black', 'e7'),
    ]);
    state.activeModifiers = [storm];
    state.tiles.set('d1', { square: 'd1', effects: [], storm: 'active', isVoid: true });
    const targets = chessEngine.getLegalMoves(state, 'd4');
    expect(targets).toContain('d2');
    expect(targets).not.toContain('d1');
  });
});
