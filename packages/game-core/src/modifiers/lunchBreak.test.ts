import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { listBotMoves } from '../engine/bot';
import type { Color, GameState, Piece, Square } from '../engine/types';
import './index';
import { getShooBlocker } from '../engine/gameLoop';
import { MODIFIER_IDS } from './ids';
import { isAtLunch, isLunchMove } from './definitions/lunch-break';
import { getBindingMoveRules } from './move-rules';
import { makeEmptyState, makePiece, move } from './testHelpers';

const LUNCH = MODIFIER_IDS.lunchBreak;

/** White to play its `n`th move. */
function onMove(pieces: Piece[], n: number, extra: Array<{ id: string; sourceColor: Color }> = []): GameState {
  const state = chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), ...pieces]),
    [{ id: LUNCH, sourceColor: 'white' }, ...extra],
  );
  state.turnNumber = 2 * n - 1;
  return state;
}

const HEAVY = [makePiece('rook', 'white', 'a1'), makePiece('queen', 'white', 'd1'), makePiece('knight', 'white', 'b1')];

describe('MOD-B016 Lunch Break', () => {
  it('on your 11th, 21st, ... move, rooks and Queen cannot move', () => {
    for (const n of [11, 21, 31]) {
      const state = onMove(HEAVY, n);
      expect(isLunchMove(state, 'white')).toBe(true);
      const rook = chessEngine.validateMove(state, move('a1', 'a5', 'white'));
      expect(rook.valid).toBe(false);
      expect(rook.reason).toMatch(/Lunch Break/);
      expect(chessEngine.validateMove(state, move('d1', 'd5', 'white')).valid).toBe(false);
      expect(chessEngine.validateMove(state, move('b1', 'c3', 'white')).valid).toBe(true);
    }
    for (const n of [1, 10, 12, 20]) {
      const state = onMove(HEAVY, n);
      expect(isLunchMove(state, 'white')).toBe(false);
      expect(chessEngine.validateMove(state, move('a1', 'a5', 'white')).valid).toBe(true);
    }
  });

  it('the sign goes up at the start of your 10th move, once', () => {
    let state = chessEngine.beginTurn(onMove(HEAVY, 10));
    const signs = state.eventHistory.filter(e => e.modifierId === LUNCH);
    expect(signs).toHaveLength(1);
    expect(signs[0].message).toMatch(/Lunch next move/);
    state = chessEngine.beginTurn(state);
    expect(state.eventHistory.filter(e => e.modifierId === LUNCH)).toHaveLength(1);
  });

  it('counts through a real game: lunch lands on the 11th move', () => {
    let state = chessEngine.beginTurn(
      chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [{ id: LUNCH, sourceColor: 'white' }]),
    );
    const files = ['a', 'b', 'c', 'd', 'h'] as const;
    for (const f of files) {
      for (const [w, b] of [[3, 6], [4, 5]] as const) {
        state = chessEngine.applyMove(state, move(`${f}${w - 1}` as Square, `${f}${w}` as Square, 'white'));
        state = chessEngine.applyMove(state, move(`${f}${b + 1}` as Square, `${f}${b}` as Square, 'black'));
      }
    }
    expect(state.status).toBe('active');
    expect(isLunchMove(state, 'white')).toBe(true);
    expect(chessEngine.validateMove(state, move('a1', 'a3', 'white')).valid).toBe(false);
  });

  it('the feed says so again on the lunch move', () => {
    const state = chessEngine.beginTurn(onMove(HEAVY, 11));
    expect(state.eventHistory[state.eventHistory.length - 1]?.message).toMatch(/at lunch this move/);
  });

  it('Equivalent Exchange: the Chancellor replaced a rook, so it goes to lunch', () => {
    const state = onMove([makePiece('chancellor', 'white', 'a1'), makePiece('knight', 'white', 'b1')], 11);
    expect(chessEngine.validateMove(state, move('a1', 'a5', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('b1', 'c3', 'white')).valid).toBe(true);
  });

  it('castling is not allowed at lunch: the rook would move', () => {
    const state = onMove([makePiece('rook', 'white', 'h1'), makePiece('knight', 'white', 'b1')], 11);
    state.flags.castlingRights.white = { kingSide: true, queenSide: false };
    expect(chessEngine.validateMove(state, move('e1', 'g1', 'white', { isCastle: 'kingside' })).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('e1', 'f1', 'white')).valid).toBe(true);
  });

  it('in check, lunch is cancelled', () => {
    const state = onMove([makePiece('rook', 'white', 'a5'), makePiece('rook', 'black', 'e5'), makePiece('knight', 'white', 'b1')], 11);
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(isAtLunch(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('a5', 'e5', 'white')).valid).toBe(true);
  });

  it('never softlocks: if only rooks and Queen can move, lunch is waived', () => {
    const state = onMove([makePiece('rook', 'white', 'h1')], 11);
    // The King's squares are all covered.
    state.pieces.set('d3', makePiece('rook', 'black', 'd3'));
    state.pieces.set('f3', makePiece('rook', 'black', 'f3'));
    state.pieces.set('a2', makePiece('rook', 'black', 'a2'));
    expect(chessEngine.isInCheck(state, 'white')).toBe(false);
    expect(isLunchMove(state, 'white')).toBe(true);
    expect(isAtLunch(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('h1', 'h5', 'white')).valid).toBe(true);
  });

  it('shooing Gerald is still allowed at lunch', () => {
    const state = onMove([...HEAVY.slice(1), { ...makePiece('rook', 'white', 'a1'), cooldowns: { [MODIFIER_IDS.gerald]: 2 } }], 11);
    expect(getShooBlocker(state)).toBeNull();
  });

  it('only binds the owner', () => {
    const state = onMove([makePiece('rook', 'black', 'a8')], 11);
    state.turn = 'black';
    expect(chessEngine.validateMove(state, move('a8', 'a2', 'black')).valid).toBe(true);
  });

  it('bots leave rooks and Queen alone at lunch', () => {
    const moves = listBotMoves(onMove(HEAVY, 11), 'white');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.from !== 'a1' && m.from !== 'd1')).toBe(true);
  });

  it('Main Character Syndrome: lunch wins, the Queen demand waits', () => {
    const state = onMove(HEAVY, 11, [{ id: MODIFIER_IDS.mainCharacterSyndrome, sourceColor: 'white' }]);
    expect(getBindingMoveRules(state, 'white').map(b => b.id)).toEqual([LUNCH]);
    expect(chessEngine.validateMove(state, move('d1', 'd5', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('b1', 'c3', 'white')).valid).toBe(true);
  });

  it('Roll For Initiative: a rook roll at lunch leaves you free', () => {
    const state = onMove(HEAVY, 11, [{ id: MODIFIER_IDS.rollForInitiative, sourceColor: 'white' }]);
    state.modifierState = { ...state.modifierState, [MODIFIER_IDS.rollForInitiative]: { roll: { color: 'white', turnNumber: state.turnNumber, type: 'rook' } } };
    expect(getBindingMoveRules(state, 'white').map(b => b.id)).toEqual([LUNCH]);
    expect(chessEngine.validateMove(state, move('b1', 'c3', 'white')).valid).toBe(true);
  });
});
