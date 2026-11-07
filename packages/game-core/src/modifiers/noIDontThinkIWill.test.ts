import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import { MODIFIER_IDS } from './ids';
import { flipSquare, flippedMovesLeft, FLIPPED_MOVES } from './definitions/no-i-dont-think-i-will';
import { move } from './testHelpers';
import type { Square } from '../engine/types';

const card = { id: MODIFIER_IDS.noIDontThinkIWill, name: 'No', activeFor: 'both' as const, sourceColor: 'white' as const };

describe('No, I Don\'t Think I Will', () => {
  it('flips squares across the board\'s centre', () => {
    expect(flipSquare('e4')).toBe('d5');
    expect(flipSquare('a1')).toBe('h8');
    expect(flipSquare(flipSquare('c7'))).toBe('c7');
  });

  it('flips the owner\'s first 5 moves, then says so', () => {
    let state = chessEngine.getInitialState();
    state.activeModifiers = [card];
    expect(flippedMovesLeft(state, 'white')).toBe(FLIPPED_MOVES);
    expect(flippedMovesLeft(state, 'black')).toBe(0);
    const shuffle: [Square, Square][] = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
    for (const [from, to] of [...shuffle, ...shuffle]) state = chessEngine.applyMove(state, move(from, to, state.turn));
    // 4 white moves so far.
    expect(flippedMovesLeft(state, 'white')).toBe(1);
    state = chessEngine.applyMove(state, move('b1', 'c3', 'white'));
    expect(flippedMovesLeft(state, 'white')).toBe(0);
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toBe('The white side\'s controls are back to normal.');
  });
});
