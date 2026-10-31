import { describe, expect, it } from 'vitest';
import './index';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState } from '../engine/types';
import { MODIFIER_IDS } from './ids';
import { getPigeonHops, hatofulGambitDef, PIGEON_HOP_PLIES } from './definitions/hatoful-gambit';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.hatofulGambit;
const instance = { id: ID, name: 'Hatoful Gambit', activeFor: 'both' as const, sourceColor: 'white' as const };

function atPly(state: GameState, plies: number): GameState {
  state.activeModifiers = [instance];
  state.moveHistory = Array.from({ length: plies }, () => ({
    move: move('a2', 'a3', 'white'),
    pieceMoved: makePiece('pawn', 'white', 'a2'),
    notation: 'a3',
  }));
  return state;
}

describe('Hatoful Gambit', () => {
  it('turns only the owner\'s knights into pigeons that move like knights', () => {
    let state = chessEngine.getInitialState();
    state.activeModifiers = [instance];
    state = hatofulGambitDef.onActivate!(state);
    expect(state.pieces.get('b1')?.type).toBe('pigeon');
    expect(state.pieces.get('g1')?.type).toBe('pigeon');
    expect(state.pieces.get('b8')?.type).toBe('knight');
    expect(chessEngine.getLegalMoves(state, 'g1').sort()).toEqual(['f3', 'h3']);
  });

  it('announces a hop, then hops there one move later', () => {
    const pieces = [makePiece('king', 'white', 'h1'), makePiece('king', 'black', 'a8'), makePiece('pigeon', 'white', 'd4', 'p1')];
    const announced = hatofulGambitDef.onPostMove!(atPly(makeEmptyState(pieces), PIGEON_HOP_PLIES - 3), move('h1', 'h1', 'white'));
    const target = [...getPigeonHops(announced).keys()][0];
    expect(target).toBeDefined();
    expect(announced.pieces.get('d4')?.type).toBe('pigeon');

    const ready = atPly(announced, PIGEON_HOP_PLIES - 1);
    const hopped = hatofulGambitDef.onPostMove!(ready, move('a8', 'a7', 'black'));
    expect(hopped.pieces.get(target)?.id).toBe('p1');
    expect(hopped.pieces.has('d4')).toBe(false);
    expect(getPigeonHops(hopped).size).toBe(0);
  });

  it('stays put if the square became unsafe', () => {
    const pieces = [makePiece('king', 'white', 'h1'), makePiece('king', 'black', 'a8'), makePiece('pigeon', 'white', 'd4', 'p1')];
    const state = atPly(makeEmptyState(pieces), PIGEON_HOP_PLIES - 1);
    state.modifierState[ID] = { plans: { p1: 'e6' } };
    state.pieces.set('e6', makePiece('pawn', 'white', 'e6'));
    const after = hatofulGambitDef.onPostMove!(state, move('a8', 'a7', 'black'));
    expect(after.pieces.get('d4')?.id).toBe('p1');
  });
});
