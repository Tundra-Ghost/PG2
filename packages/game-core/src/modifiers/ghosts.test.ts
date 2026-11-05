import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { MODIFIER_IDS } from './ids';
import { ghostsDef, GHOSTS_PER_SIDE } from './definitions/ghosts';
import { makeEmptyState, makePiece, move } from './testHelpers';
import type { Piece } from '../engine/types';

const card = { id: MODIFIER_IDS.ghosts, name: 'Ghosts', activeFor: 'both' as const, sourceColor: 'white' as const };
const ghost = (type: Piece['type'], square: Piece['square']): Piece => ({ ...makePiece(type, 'white', square), isGhost: true });

describe('I\'m Literally Right Here', () => {
  it('gives the owner 2 Ghosts on their third rank', () => {
    const state = chessEngine.getInitialState();
    state.activeModifiers = [card];
    const next = ghostsDef.onActivate!(state);
    const ghosts = [...next.pieces.values()].filter(p => p.isGhost);
    expect(ghosts).toHaveLength(GHOSTS_PER_SIDE);
    for (const g of ghosts) {
      expect(g.color).toBe('white');
      expect(g.square[1]).toBe('3');
      expect(['knight', 'bishop']).toContain(g.type);
    }
  });

  it('moves like its type but never captures', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
      ghost('bishop', 'c3'),
      makePiece('rook', 'black', 'e5'),
    ]);
    state.activeModifiers = [card];
    expect(chessEngine.validateMove(state, move('c3', 'd4', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('c3', 'e5', 'white')).valid).toBe(false);
  });

  it('never gives check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
      ghost('bishop', 'c3'),
    ]);
    state.activeModifiers = [card];
    expect(chessEngine.isInCheck(state, 'black')).toBe(false);
  });

  it('vanishes with an event when captured', () => {
    let state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('king', 'black', 'h8'),
      ghost('knight', 'c3'),
      makePiece('rook', 'black', 'c8'),
    ]);
    state.activeModifiers = [card];
    state.turn = 'black';
    state = chessEngine.applyMove(state, move('c8', 'c3', 'black'));
    expect(state.pieces.get('c3')?.type).toBe('rook');
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toBe('The white knight on c3 was a Ghost. It vanishes.');
  });
});
