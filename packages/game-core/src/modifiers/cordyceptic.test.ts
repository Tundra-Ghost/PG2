import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Square } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { cordycepticSpreadDef, getInfectedReach, isInfectedSquare } from './definitions/cordyceptic-spread';
import { makeEmptyState, makePiece, move } from './testHelpers';

const spread = { id: MODIFIER_IDS.cordycepticSpread, name: 'The Cordyceptic Spread', activeFor: 'both' as const, sourceColor: null };

function setup(pieces: Parameters<typeof makeEmptyState>[0], infected: Square[] = [], plies = 0): GameState {
  const state = makeEmptyState(pieces);
  state.activeModifiers = [spread];
  for (const sq of infected) state.tiles.set(sq, { square: sq, effects: [{ type: 'infected', turnsRemaining: -1 }] });
  state.moveHistory = Array.from({ length: plies }, () => ({
    move: move('a2', 'a3', 'white'),
    pieceMoved: makePiece('pawn', 'white', 'a2'),
    notation: 'a3',
  }));
  return state;
}

const kings = () => [makePiece('king', 'white', 'h1'), makePiece('king', 'black', 'h8')];

describe('The Cordyceptic Spread', () => {
  it('grows a new Infected tile on an empty square every 5 rounds', () => {
    const quiet = cordycepticSpreadDef.onPostMove!(setup(kings(), [], 8), move('h1', 'h1', 'white'));
    expect([...quiet.tiles.keys()].filter(sq => isInfectedSquare(quiet, sq))).toHaveLength(0);

    const grown = cordycepticSpreadDef.onPostMove!(setup(kings(), [], 9), move('h1', 'h1', 'white'));
    const infected = [...grown.tiles.keys()].filter(sq => isInfectedSquare(grown, sq));
    expect(infected).toHaveLength(1);
    expect(grown.pieces.has(infected[0])).toBe(false);
    const event = grown.eventHistory.find(e => e.modifierId === MODIFIER_IDS.cordycepticSpread);
    expect(event?.squares).toEqual(infected);
  });

  it('spreads to neighbours over time but never onto lava', () => {
    let state = setup(kings(), ['d4']);
    state.tiles.set('d5', { square: 'd5', effects: [{ type: 'lava', turnsRemaining: -1 }] });
    for (let ply = 1; ply <= 40; ply += 2) {
      state.moveHistory = state.moveHistory.concat(
        { move: move('a2', 'a3', 'white'), pieceMoved: makePiece('pawn', 'white', 'a2'), notation: 'a3' },
      );
      state = cordycepticSpreadDef.onPostMove!(state, move('h1', 'h1', 'white'));
      state.moveHistory = state.moveHistory.concat(
        { move: move('a7', 'a6', 'black'), pieceMoved: makePiece('pawn', 'black', 'a7'), notation: 'a6' },
      );
    }
    const infected = [...state.tiles.keys()].filter(sq => isInfectedSquare(state, sq));
    expect(infected.length).toBeGreaterThan(1);
    expect(isInfectedSquare(state, 'd5')).toBe(false);
  });

  it('slows a rook that stands still on infection, one square per round', () => {
    let state = setup([...kings(), makePiece('rook', 'white', 'a1'), makePiece('pawn', 'white', 'b2')], ['a1']);
    expect(getInfectedReach(state, 'a1')).toBeNull();
    // White moves something else twice: the rook rots two rounds.
    state = cordycepticSpreadDef.onPostMove!(state, move('b2', 'b3', 'white'));
    state = cordycepticSpreadDef.onPostMove!(state, move('b3', 'b4', 'white'));
    expect(getInfectedReach(state, 'a1')).toBe(5);

    const far = cordycepticSpreadDef.onPreMoveValidate!(state, move('a1', 'a7', 'white'));
    expect(far.blocked).toBe(true);
    expect(cordycepticSpreadDef.onPreMoveValidate!(state, move('a1', 'a6', 'white')).blocked).toBe(false);
  });

  it('takes the double step from an infected pawn and leaves knights alone', () => {
    let state = setup([...kings(), makePiece('pawn', 'white', 'e2'), makePiece('knight', 'white', 'g1'), makePiece('pawn', 'white', 'a2')], ['e2', 'g1']);
    state = cordycepticSpreadDef.onPostMove!(state, move('a2', 'a3', 'white'));
    expect(cordycepticSpreadDef.onPreMoveValidate!(state, move('e2', 'e4', 'white')).blocked).toBe(true);
    expect(cordycepticSpreadDef.onPreMoveValidate!(state, move('e2', 'e3', 'white')).blocked).toBe(false);
    expect(getInfectedReach(state, 'g1')).toBeNull();
  });

  it('resets the rot when the piece moves', () => {
    let state = setup([...kings(), makePiece('rook', 'white', 'a1'), makePiece('pawn', 'white', 'b2')], ['a1', 'a3']);
    state = cordycepticSpreadDef.onPostMove!(state, move('b2', 'b3', 'white'));
    expect(getInfectedReach(state, 'a1')).toBe(6);
    state.pieces.set('a3', { ...state.pieces.get('a1')!, square: 'a3' });
    state.pieces.delete('a1');
    state = cordycepticSpreadDef.onPostMove!(state, move('a1', 'a3', 'white'));
    expect(getInfectedReach(state, 'a3')).toBeNull();
  });

  it('lets a bishop clear every infected square it crosses', () => {
    const state = setup([...kings(), makePiece('bishop', 'white', 'e5')], ['b2', 'c3', 'f6']);
    const after = cordycepticSpreadDef.onPostMove!(state, move('a1', 'e5', 'white'));
    expect(isInfectedSquare(after, 'b2')).toBe(false);
    expect(isInfectedSquare(after, 'c3')).toBe(false);
    expect(isInfectedSquare(after, 'f6')).toBe(true);
  });

  it('works through the engine without blocking legal play', () => {
    let state = chessEngine.getInitialState();
    state.activeModifiers = [spread];
    const moves: [Square, Square][] = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'], ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'], ['g1', 'f3'], ['g8', 'f6']];
    for (const [from, to] of moves) {
      state = chessEngine.applyMove(state, move(from, to, state.turn));
    }
    expect([...state.tiles.keys()].some(sq => isInfectedSquare(state, sq))).toBe(true);
  });
});
