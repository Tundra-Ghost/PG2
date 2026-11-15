import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getLegalMovesForPiece } from '../engine/moveGenerator';
import type { Color, GameState } from '../engine/types';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { MODIFIER_IDS } from './ids';
import { move } from './testHelpers';

const STONKS = MODIFIER_IDS.stonks;
const built = new Set(modifierRegistry.getAll().map(def => def.id));

function start(picks: { id: string; sourceColor: Color }[]): GameState {
  return chessEngine.activateDraftModifiers(chessEngine.getInitialState(), picks);
}

function count(state: GameState, color: Color, type: string): number {
  return [...state.pieces.values()].filter(p => p.color === color && p.type === type).length;
}

describe('MOD-E015 Stonks', () => {
  it('trades the a- and h-pawns for a knight on b3', () => {
    const state = start([{ id: STONKS, sourceColor: 'white' }]);
    expect(state.pieces.has('a2')).toBe(false);
    expect(state.pieces.has('h2')).toBe(false);
    expect(state.pieces.get('b3')).toMatchObject({ type: 'knight', color: 'white' });
    expect(count(state, 'white', 'pawn')).toBe(6);
    expect(count(state, 'white', 'knight')).toBe(3);
    // The other side keeps its full army, and both kings are untouched.
    expect(count(state, 'black', 'pawn')).toBe(8);
    expect(state.pieces.get('e1')).toMatchObject({ type: 'king', color: 'white' });
    expect(state.pieces.get('e8')).toMatchObject({ type: 'king', color: 'black' });
  });

  it('puts Black\'s knight on b6', () => {
    const state = start([{ id: STONKS, sourceColor: 'black' }]);
    expect(state.pieces.has('a7')).toBe(false);
    expect(state.pieces.has('h7')).toBe(false);
    expect(state.pieces.get('b6')).toMatchObject({ type: 'knight', color: 'black' });
    expect(state.pieces.has('a2')).toBe(true);
  });

  it('the new knight plays like any knight', () => {
    let state = start([{ id: STONKS, sourceColor: 'white' }]);
    expect(getLegalMovesForPiece(state, state.pieces.get('b3')!).sort()).toEqual(['a5', 'c5', 'd4']);
    state = chessEngine.applyMove(state, move('b3', 'd4', 'white'));
    expect(state.pieces.get('d4')).toMatchObject({ type: 'knight', color: 'white' });
  });

  it('counts the new start position for repetition', () => {
    const state = start([{ id: STONKS, sourceColor: 'white' }]);
    expect(Object.values(state.positionHistory)).toEqual([1]);
  });

  it('only trades before the first move', () => {
    let state = chessEngine.getInitialState();
    state = chessEngine.applyMove(state, move('e2', 'e4', 'white'));
    state = chessEngine.activateDraftModifiers(state, [{ id: STONKS, sourceColor: 'white' }]);
    expect(state.pieces.has('a2')).toBe(true);
    expect(state.pieces.has('b3')).toBe(false);
  });

  it('with Hatoful Gambit, the new knight is a pigeon too', () => {
    const before = start([{ id: MODIFIER_IDS.hatofulGambit, sourceColor: 'white' }, { id: STONKS, sourceColor: 'white' }]);
    expect(before.pieces.get('b3')?.type).toBe('pigeon');
    const after = start([{ id: STONKS, sourceColor: 'white' }, { id: MODIFIER_IDS.hatofulGambit, sourceColor: 'white' }]);
    expect(after.pieces.get('b3')?.type).toBe('pigeon');
  });

  it('with Lawrence Of Arabia, the new knight is a camel too', () => {
    const before = start([{ id: MODIFIER_IDS.lawrenceOfArabia, sourceColor: 'white' }, { id: STONKS, sourceColor: 'white' }]);
    expect(before.pieces.get('b3')?.type).toBe('camel');
    const after = start([{ id: STONKS, sourceColor: 'white' }, { id: MODIFIER_IDS.lawrenceOfArabia, sourceColor: 'white' }]);
    expect(after.pieces.get('b3')?.type).toBe('camel');
  });

  it('with Knight Rider, the new knight is a nightrider too', () => {
    const before = start([{ id: MODIFIER_IDS.knightRider, sourceColor: 'white' }, { id: STONKS, sourceColor: 'white' }]);
    expect(before.pieces.get('b3')?.type).toBe('nightrider');
    const after = start([{ id: STONKS, sourceColor: 'white' }, { id: MODIFIER_IDS.knightRider, sourceColor: 'white' }]);
    expect(after.pieces.get('b3')?.type).toBe('nightrider');
  });

  it('cannot be drafted with The Small Council', () => {
    const options = getValidOptions([MODIFIER_IDS.smallCouncil], [], built).map(card => card.id);
    expect(options).not.toContain(STONKS);
    const card = ALL_MODIFIERS.find(c => c.id === STONKS)!;
    expect(pickBlocker(card, [MODIFIER_IDS.smallCouncil], [], built)).toBe('Does not work with The Small Council.');
    expect(getValidOptions([STONKS], [], built).map(c => c.id)).not.toContain(MODIFIER_IDS.smallCouncil);
    // The opponent may still hold the other card.
    expect(getValidOptions([], [MODIFIER_IDS.smallCouncil], built).map(c => c.id)).toContain(STONKS);
  });

  it('finds the next free square when b3 is taken', () => {
    const base = chessEngine.getInitialState();
    base.pieces.set('b3', { id: 'blocker', type: 'bishop', color: 'white', square: 'b3', cooldowns: {} });
    const state = chessEngine.activateDraftModifiers(base, [{ id: STONKS, sourceColor: 'white' }]);
    expect(state.pieces.get('c3')).toMatchObject({ type: 'knight', color: 'white' });
  });
});
