import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { TIDE, isFlooded } from './definitions/tide';
import { timedPhase } from './timed';
import { getValidOptions } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';

const TIDE_ID = MODIFIER_IDS.tideGoesIn;

function withTide(pieces: Piece[]): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: TIDE_ID, sourceColor: 'white' }]));
}

/** Kings shuffle a1-b1 and h8-g8 until turnNumber reaches `target`. */
function playTo(state: GameState, target: number): GameState {
  const steps: Record<string, Square> = { a1: 'b1', b1: 'a1', h8: 'g8', g8: 'h8' };
  while (state.turnNumber < target) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn && steps[p.square])!;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

const BASE = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('pawn', 'white', 'a2'), makePiece('pawn', 'black', 'h7')];

describe('MOD-A017 Tide Goes In, Tide Goes Out', () => {
  it('schedule: warning on turns 15-16, water on 17-24, then every 16 turns', () => {
    expect(timedPhase(14, TIDE)).toBeNull();
    expect(timedPhase(15, TIDE)).toBe('warning');
    expect(timedPhase(16, TIDE)).toBe('warning');
    expect(timedPhase(17, TIDE)).toBe('active');
    expect(timedPhase(24, TIDE)).toBe('active');
    expect(timedPhase(25, TIDE)).toBeNull();
    expect(timedPhase(31, TIDE)).toBe('warning');
    expect(timedPhase(33, TIDE)).toBe('active');
  });

  it('warns the round before, floods, then ebbs', () => {
    let state = withTide(BASE());
    state = playTo(state, 15);
    expect(state.tiles.get('d4')?.tide).toBe('warning');
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: TIDE_ID, message: expect.stringMatching(/next round/) });
    state = playTo(state, 17);
    expect(isFlooded(state)).toBe(true);
    expect(state.tiles.get('h5')?.tide).toBe('active');
    state = playTo(state, 25);
    expect(isFlooded(state)).toBe(false);
    expect(state.tiles.get('d4')).toBeUndefined();
  });

  it('only knights and Kings may stop on water; others may cross it', () => {
    let state = withTide([...BASE(), makePiece('rook', 'white', 'c1'), makePiece('knight', 'white', 'g1')]);
    state = playTo(state, 17);
    expect(chessEngine.validateMove(state, move('c1', 'c4', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('c1', 'c6', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('g1', 'f3', 'white')).valid).toBe(true);
    // A pawn cannot double-step onto the water.
    expect(chessEngine.validateMove(state, move('a2', 'a4', 'white')).valid).toBe(false);
  });

  it('a piece caught on the water may only move off it', () => {
    let state = withTide([...BASE(), makePiece('bishop', 'white', 'c4'), makePiece('knight', 'white', 'e4')]);
    state = playTo(state, 17);
    expect(chessEngine.validateMove(state, move('c4', 'd5', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('c4', 'e6', 'white')).valid).toBe(true);
    // Knights may hop from water to water.
    expect(chessEngine.validateMove(state, move('e4', 'g5', 'white')).valid).toBe(true);
  });

  it('a King caught by the tide moves normally, and lines of check cross water', () => {
    let state = withTide([makePiece('king', 'white', 'd4'), makePiece('king', 'black', 'h8'), makePiece('rook', 'black', 'a8'), makePiece('pawn', 'white', 'b2'), makePiece('pawn', 'black', 'h7')]);
    const steps: Record<string, Square> = { d4: 'd3', d3: 'd4', h8: 'g8', g8: 'h8' };
    while (state.turnNumber < 17) {
      const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn)!;
      state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
    }
    expect(isFlooded(state)).toBe(true);
    expect(state.pieces.get('d4')?.type).toBe('king');
    expect(chessEngine.validateMove(state, move('d4', 'e5', 'white')).valid).toBe(true);
    // It may step from water to water.
    expect(chessEngine.validateMove(state, move('d4', 'd5', 'white')).valid).toBe(true);
    // The a8 rook still checks along the a-file across the water: a King on b4 may not step to a4.
    const onB4 = { ...state, pieces: new Map(state.pieces) };
    const king = onB4.pieces.get('d4')!;
    onB4.pieces.delete('d4');
    onB4.pieces.set('b4', { ...king, square: 'b4' });
    expect(chessEngine.validateMove(onB4, move('b4', 'a4', 'white')).valid).toBe(false);
  });

  it('shares ranks 4 and 5 with This Is My Swamp and The Birds: one per match (interaction)', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    const ids = getValidOptions([], [TIDE_ID], built).map(c => c.id);
    expect(ids).not.toContain(MODIFIER_IDS.thisIsMySwamp);
    expect(ids).not.toContain(MODIFIER_IDS.theBirds);
    expect(ids).not.toContain(MODIFIER_IDS.thinkingWithPortals);
    expect(getValidOptions([], [TIDE_ID], new Set([...built, 'MOD-A013'])).map(c => c.id)).not.toContain('MOD-A013');
  });
});
