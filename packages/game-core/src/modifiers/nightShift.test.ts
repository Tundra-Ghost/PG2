import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece, Square } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { NIGHT, getNightPhase, getSky } from './definitions/night-shift';
import { timedPhase } from './timed';
import { getVisibleSquares } from '../engine/visibility';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { redactForViewer } from '../net/redact';
import { ALL_MODIFIERS } from './data';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.nightShift;

function start(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: ID, sourceColor: 'white' }, ...extra]));
}

/** Kings shuffle a1-b1 and h8-g8 until round `round` begins (White to move). */
function playToRound(state: GameState, round: number): GameState {
  const steps: Record<string, Square> = { a1: 'b1', b1: 'a1', h8: 'g8', g8: 'h8' };
  while (state.flags.fullMoveNumber < round) {
    const king = Array.from(state.pieces.values()).find(p => p.type === 'king' && p.color === state.turn && steps[p.square])!;
    state = chessEngine.applyMove({ ...state, positionHistory: {} }, move(king.square, steps[king.square], state.turn));
  }
  return state;
}

const BASE = () => [makePiece('king', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('rook', 'black', 'h5'), makePiece('pawn', 'white', 'a2')];

describe('MOD-D010 Night Shift', () => {
  it('schedule in rounds: dusk in round 8, night in rounds 9 to 12, then every 8 rounds', () => {
    expect(timedPhase(7, NIGHT)).toBeNull();
    expect(timedPhase(8, NIGHT)).toBe('warning');
    expect(timedPhase(9, NIGHT)).toBe('active');
    expect(timedPhase(12, NIGHT)).toBe('active');
    expect(timedPhase(13, NIGHT)).toBeNull();
    expect(timedPhase(17, NIGHT)).toBe('active');
  });

  it('by day everyone sees everything; at night only 2 squares around your own pieces', () => {
    let state = start(BASE());
    expect(getVisibleSquares(state, 'white')).toBeNull();
    state = playToRound(state, 9);
    expect(getNightPhase(state)).toBe('active');
    const white = getVisibleSquares(state, 'white')!;
    expect(white.has('c3')).toBe(true);
    expect(white.has('h5')).toBe(false);
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: ID, title: 'Night' });
    state = playToRound(state, 13);
    expect(getVisibleSquares(state, 'white')).toBeNull();
    expect(state.eventHistory[state.eventHistory.length - 1]).toMatchObject({ modifierId: ID, title: 'Day' });
  });

  it('online, enemy pieces in the dark are not sent at night', () => {
    const state = playToRound(start(BASE()), 9);
    const seen = redactForViewer(state, 'white');
    expect(seen.pieces.has('h5')).toBe(false);
    expect(seen.pieces.has('a2')).toBe(true);
    expect(redactForViewer(playToRound(state, 13), 'white').pieces.has('h5')).toBe(true);
  });

  it('the sky tells the time of day', () => {
    let state = start(BASE());
    expect(getSky(state)).toEqual({ night: false, text: 'Day: night in 8 rounds' });
    state = playToRound(state, 8);
    expect(getSky(state)).toEqual({ night: false, text: 'Dusk: night next round' });
    state = playToRound(state, 9);
    expect(getSky(state)).toEqual({ night: true, text: 'Night: 4 rounds left' });
    state = playToRound(state, 12);
    expect(getSky(state)).toEqual({ night: true, text: 'Night: last round' });
    expect(getSky({ ...state, activeModifiers: [] })).toBeNull();
  });

  it('Cat Mode sees one square further at night (interaction)', () => {
    const state = playToRound(start(BASE(), [{ id: MODIFIER_IDS.catMode, sourceColor: 'white' }]), 9);
    expect(getVisibleSquares(state, 'white')!.has('d4')).toBe(true);
    expect(getVisibleSquares(state, 'black')!.has('e5')).toBe(false);
  });

  it('one per match with It\'s Dark And I\'m Scared; Cat Mode, Footprints and Flashlight are offered with it', () => {
    const built = new Set(ALL_MODIFIERS.map(c => c.id));
    expect(getValidOptions([], [MODIFIER_IDS.darkAndScared], built).map(c => c.id)).not.toContain(ID);
    expect(getValidOptions([ID], [], built).map(c => c.id)).not.toContain(MODIFIER_IDS.darkAndScared);
    const offered = getValidOptions([ID], [], built).map(c => c.id);
    for (const support of [MODIFIER_IDS.catMode, MODIFIER_IDS.footprints, MODIFIER_IDS.flashlight]) expect(offered).toContain(support);
    const cat = ALL_MODIFIERS.find(c => c.id === MODIFIER_IDS.catMode)!;
    expect(pickBlocker(cat, [], [], built)).toMatch(/Night Shift/);
  });
});
