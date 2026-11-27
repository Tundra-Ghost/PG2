import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { QUAKE, getQuakeArrows, type Shake } from './definitions/shake-it-off';
import { timedPhase } from './timed';
import { getValidOptions } from '../draft/rules';
import { redactForViewer } from '../net/redact';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.shakeItOff;

function start(pieces: Piece[], seed = 1): GameState {
  const state = makeEmptyState(pieces);
  state.prngState = seed;
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(state, [{ id: ID, sourceColor: 'white' }]));
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

/** Replaces the planned arrows (the state must be in the warning round). */
function setShakes(state: GameState, shakes: Shake[]): GameState {
  const memo = state.modifierState[ID] as Record<string, unknown>;
  return { ...state, modifierState: { ...state.modifierState, [ID]: { ...memo, shakes } } };
}

const KINGS = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8')];

describe('MOD-A018 Shake It Off', () => {
  it('schedule in rounds: arrows in round 10, quake at the start of round 11, then every 10 rounds', () => {
    expect(timedPhase(9, QUAKE)).toBeNull();
    expect(timedPhase(10, QUAKE)).toBe('warning');
    expect(timedPhase(11, QUAKE)).toBe('active');
    expect(timedPhase(12, QUAKE)).toBeNull();
    expect(timedPhase(20, QUAKE)).toBe('warning');
    expect(timedPhase(21, QUAKE)).toBe('active');
  });

  it('an extra turn never brings the quake before Black has moved in round 10', () => {
    let state = playTo(start([...KINGS(), makePiece('rook', 'white', 'd4')]), 19);
    state = setShakes(state, [{ id: 'white-rook-d4', df: 1, dr: 0 }]);
    // White spends an extra turn: turnNumber reaches 21 while it is still round 10.
    state = chessEngine.applyMove({ ...state, tempoTokens: { ...state.tempoTokens, white: 1 } }, move('a1', 'b1', 'white', { extraTurn: true }));
    state = chessEngine.applyMove(state, move('b1', 'a1', 'white'));
    expect(state.turn).toBe('black');
    expect(state.pieces.get('d4')).toMatchObject({ type: 'rook' });
    state = chessEngine.applyMove(state, move('h8', 'g8', 'black'));
    expect(state.pieces.get('e4')).toMatchObject({ type: 'rook' });
  });

  it('no arrow on a piece that now faces the edge', () => {
    let state = playTo(start([...KINGS(), makePiece('rook', 'white', 'g4')]), 19);
    state = setShakes(state, [{ id: 'white-rook-g4', df: 1, dr: 0 }]);
    expect(getQuakeArrows(state, 'white')).toHaveLength(1);
    state = chessEngine.applyMove(state, move('g4', 'h4', 'white'));
    expect(getQuakeArrows(state, 'white')).toEqual([]);
  });

  it('shows one on-board arrow per non-King piece a round ahead, the same for the same seed', () => {
    const pieces = () => [...KINGS(), makePiece('rook', 'white', 'h1'), makePiece('knight', 'black', 'd5'), makePiece('pawn', 'white', 'c2')];
    let state = playTo(start(pieces()), 18);
    expect(getQuakeArrows(state, 'white')).toEqual([]);
    state = playTo(state, 19);
    const arrows = getQuakeArrows(state, 'white');
    expect(arrows.map(a => a.square).sort()).toEqual(['c2', 'd5', 'h1']);
    const h1 = arrows.find(a => a.square === 'h1')!;
    expect(h1.df).toBeLessThanOrEqual(0);
    expect(h1.dr).toBeGreaterThanOrEqual(0);
    expect(getQuakeArrows(playTo(start(pieces()), 19), 'white')).toEqual(arrows);
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: ID, title: 'Tremor' });
  });

  it('the quake moves each piece one square its arrow\'s way, once', () => {
    let state = playTo(start([...KINGS(), makePiece('rook', 'white', 'd4'), makePiece('knight', 'black', 'e6')]), 19);
    state = setShakes(state, [{ id: 'white-rook-d4', df: 1, dr: 1 }, { id: 'black-knight-e6', df: -1, dr: 0 }]);
    state = playTo(state, 21);
    expect(state.pieces.get('e5')).toMatchObject({ type: 'rook' });
    expect(state.pieces.get('d6')).toMatchObject({ type: 'knight' });
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: ID, title: 'Earthquake' });
    expect(getQuakeArrows(state, 'white')).toEqual([]);
    state = playTo(state, 23);
    expect(state.pieces.get('e5')).toMatchObject({ type: 'rook' });
  });

  it('never captures: a piece whose square is taken waits; one freed by the quake follows', () => {
    let state = playTo(start([...KINGS(), makePiece('rook', 'white', 'd4'), makePiece('pawn', 'black', 'd5'), makePiece('bishop', 'white', 'c4'), makePiece('pawn', 'black', 'f6')]), 19);
    state = setShakes(state, [
      { id: 'white-bishop-c4', df: 1, dr: 0 },
      { id: 'white-rook-d4', df: 1, dr: 0 },
      { id: 'black-pawn-d5', df: 1, dr: -1 },
    ]);
    state = playTo(state, 21);
    expect(state.pieces.get('e4')).toMatchObject({ type: 'rook' });
    expect(state.pieces.get('d4')).toMatchObject({ type: 'bishop' });
    expect(state.pieces.get('d5')).toMatchObject({ type: 'pawn', color: 'black' });
    expect(state.pieces.get('f6')).toMatchObject({ type: 'pawn', color: 'black' });
  });

  it('never moves a King, never exposes a King and never lands a pawn on its last rank', () => {
    // The rook on a4 shields the King on a1 from the rook on a8.
    let state = playTo(start([...KINGS(), makePiece('rook', 'white', 'a4'), makePiece('rook', 'black', 'a8'), makePiece('pawn', 'white', 'e7')]), 19);
    state = setShakes(state, [
      { id: 'white-king-a1', df: 0, dr: 1 },
      { id: 'white-rook-a4', df: 1, dr: 0 },
      { id: 'white-pawn-e7', df: 0, dr: 1 },
    ]);
    state = playTo(state, 21);
    expect(state.pieces.get('a1')).toMatchObject({ type: 'king' });
    expect(state.pieces.get('a4')).toMatchObject({ type: 'rook', color: 'white' });
    expect(state.pieces.get('e7')).toMatchObject({ type: 'pawn' });
    expect(chessEngine.isInCheck(state, 'white')).toBe(false);
  });

  it('one per match with Gravitational Anomaly', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    expect(getValidOptions([], [MODIFIER_IDS.gravitationalAnomaly], built).map(c => c.id)).not.toContain(ID);
    expect(getValidOptions([ID], [], built).map(c => c.id)).not.toContain(MODIFIER_IDS.gravitationalAnomaly);
  });

  it('arrows on enemy pieces out of sight are not shown or sent (It\'s Dark And I\'m Scared)', () => {
    let state = makeEmptyState([...KINGS(), makePiece('bishop', 'white', 'd4'), makePiece('pawn', 'black', 'h7')]);
    state = chessEngine.beginTurn(chessEngine.activateDraftModifiers(state, [{ id: ID, sourceColor: 'white' }, { id: MODIFIER_IDS.darkAndScared, sourceColor: 'white' }]));
    state = playTo(state, 19);
    expect(getQuakeArrows(state, 'white').map(a => a.square)).toContain('d4');
    expect(getQuakeArrows(state, 'black').map(a => a.square)).not.toContain('d4');
    expect(getQuakeArrows(state, 'black').map(a => a.square)).toContain('h7');
    const sent = redactForViewer(state, 'black').modifierState[ID] as { shakes: Shake[] };
    expect(sent.shakes.map(s => s.id)).toEqual(['black-pawn-h7']);
  });
});
