import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { MODIFIER_IDS } from './ids';
import { getConfession } from './definitions/forgive-me';
import { makeEmptyState, makePiece, move } from './testHelpers';

const card = { id: MODIFIER_IDS.forgiveMe, name: 'Forgive Me', activeFor: 'both' as const, sourceColor: 'white' as const };
const CONFESS = { ability: MODIFIER_IDS.forgiveMe };

function setup() {
  const state = makeEmptyState([
    makePiece('king', 'white', 'a1'),
    makePiece('bishop', 'white', 'c1'),
    makePiece('rook', 'white', 'b2'),
    makePiece('king', 'black', 'h8'),
    makePiece('knight', 'black', 'f4'),
    makePiece('pawn', 'black', 'a7'),
  ]);
  state.activeModifiers = [card];
  return state;
}

describe('Forgive Me, For I Have Moved', () => {
  it('targets enemy pieces on the bishop\'s diagonal, not the King', () => {
    const state = setup();
    expect(chessEngine.validateMove(state, move('c1', 'f4', 'white', CONFESS)).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('c1', 'e3', 'white', CONFESS)).valid).toBe(false);
  });

  it('makes the piece declare its move a turn early', () => {
    let state = chessEngine.applyMove(setup(), move('c1', 'f4', 'white', CONFESS));
    expect(state.pieces.get('c1')?.type).toBe('bishop');
    expect(getConfession(state)?.square).toBe('f4');

    // Black's first knight move only declares the square.
    state = chessEngine.applyMove(state, move('f4', 'e6', 'black'));
    expect(state.pieces.get('f4')?.type).toBe('knight');
    expect(state.pieces.has('e6')).toBe(false);
    expect(getConfession(state)?.declared).toBe('e6');
    expect(state.moveHistory[state.moveHistory.length - 1].notation).toBe('N…e6');
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toBe('The black knight confesses. It will move to e6.');

    state = chessEngine.applyMove(state, move('b2', 'b3', 'white'));
    expect(chessEngine.validateMove(state, move('f4', 'd5', 'black')).valid).toBe(false);
    state = chessEngine.applyMove(state, move('f4', 'e6', 'black'));
    expect(state.pieces.get('e6')?.type).toBe('knight');
    expect(getConfession(state)).toBeNull();
  });

  it('ends after the target side\'s next 2 turns', () => {
    let state = chessEngine.applyMove(setup(), move('c1', 'f4', 'white', CONFESS));
    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    state = chessEngine.applyMove(state, move('b2', 'b3', 'white'));
    expect(getConfession(state)).not.toBeNull();
    state = chessEngine.applyMove(state, move('a6', 'a5', 'black'));
    expect(getConfession(state)).toBeNull();
  });
});
