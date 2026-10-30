import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { gravitationalAnomalyDef, gravityDirection, slideAll } from './definitions/gravitational-anomaly';
import { makeEmptyState, makePiece, move } from './testHelpers';

const gravity = { id: MODIFIER_IDS.gravitationalAnomaly, name: 'Gravitational Anomaly', activeFor: 'both' as const, sourceColor: null };

function atPly(state: GameState, plies: number): GameState {
  state.activeModifiers = [gravity];
  state.moveHistory = Array.from({ length: plies }, () => ({
    move: move('a2', 'a3', 'white'),
    pieceMoved: makePiece('pawn', 'white', 'a2'),
    notation: 'a3',
  }));
  return state;
}

const postMove = (state: GameState) => gravitationalAnomalyDef.onPostMove!(state, move('a1', 'a1', 'white'));

describe('Gravitational Anomaly', () => {
  it('pulls east, then west, back and forth', () => {
    expect([0, 1, 2, 3].map(gravityDirection)).toEqual(['east', 'west', 'east', 'west']);
  });

  it('slides a whole column together, and pieces at the edge fall off', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('rook', 'white', 'd6'),
      makePiece('knight', 'black', 'd7'),
      makePiece('bishop', 'black', 'd8'),
      makePiece('king', 'black', 'h8'),
    ]);
    const { next, lost } = slideAll(state, 'north');
    expect(next.pieces.get('d7')?.type).toBe('rook');
    expect(next.pieces.get('d8')?.type).toBe('knight');
    expect(lost.map(p => p.type)).toEqual(['bishop']);
    // Kings brace against the edge.
    expect(next.pieces.get('h8')?.type).toBe('king');
    expect(next.pieces.get('a2')?.type).toBe('king');
  });

  it('crowns a pawn pushed onto its last rank', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('pawn', 'white', 'c7'),
      makePiece('king', 'black', 'h5'),
    ]);
    const { next } = slideAll(state, 'north');
    expect(next.pieces.get('c8')).toMatchObject({ type: 'queen', color: 'white' });
  });

  it('warns the move before, then shifts and records it', () => {
    const base = () => makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('rook', 'white', 'b3'),
      makePiece('king', 'black', 'e5'),
    ]);

    const warned = postMove(atPly(base(), 21));
    expect(warned.eventHistory[warned.eventHistory.length - 1]?.message).toContain('about to shift east');
    expect(warned.pieces.has('b3')).toBe(true);

    const shifted = postMove(atPly(base(), 23));
    expect(shifted.pieces.get('c3')?.type).toBe('rook');
    expect(shifted.pieces.get('f5')?.type).toBe('king');
    const event = shifted.eventHistory[shifted.eventHistory.length - 1];
    expect(event?.ply).toBe(24);
    expect(event?.squares).toContain('c3');

    // The next shift goes west, 24 plies later.
    const again = postMove(atPly(shifted, 47));
    expect(again.pieces.get('b3')?.type).toBe('rook');
  });

  it('waits a ply rather than leave the side that just moved in check', () => {
    // East: the knight on h3 falls off, the rook g5 -> h5 would see the braced king on h1.
    const state = atPly(makeEmptyState([
      makePiece('king', 'white', 'h1'),
      makePiece('knight', 'white', 'h3'),
      makePiece('rook', 'black', 'g5'),
      makePiece('king', 'black', 'a8'),
    ]), 23);
    expect(chessEngine.isInCheck(state, 'white')).toBe(false);

    const held = postMove(state);
    expect(held.pieces.has('h3')).toBe(true);
    expect(held.modifierState[MODIFIER_IDS.gravitationalAnomaly]).toBeUndefined();

    // If black had just moved, white is to move and simply has to answer the check.
    state.turn = 'black';
    const shifted = postMove(state);
    expect(shifted.pieces.has('h3')).toBe(false);
    expect(chessEngine.isInCheck(shifted, 'white')).toBe(true);
  });
});
