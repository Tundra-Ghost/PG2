import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import { getHiddenPieceIds } from '../engine/visibility';
import { redactForViewer } from '../net/redact';
import './index';
import { MODIFIER_IDS } from './ids';
import { getLights, isLightsOut } from './definitions/jump-scare';
import { makeEmptyState, makePiece, move } from './testHelpers';
import { modifierRegistry } from './registry';

const ID = MODIFIER_IDS.jumpScare;

function start(pieces: Piece[], round: number, extra: { id: string; sourceColor: 'white' | 'black' | null }[] = []): GameState {
  const state = makeEmptyState(pieces);
  state.flags.fullMoveNumber = round;
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(state, [{ id: ID, sourceColor: null }, ...extra]));
}

const army = () => [makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('rook', 'white', 'a1'),
  makePiece('pawn', 'black', 'a5'), makePiece('knight', 'black', 'g8'), makePiece('pawn', 'white', 'h2')];

describe('MOD-D016 Jump Scare', () => {
  it('flickers in round 10, goes dark for round 11 only, then the lights come back', () => {
    let state = start(army(), 10);
    expect(isLightsOut(state)).toBe(false);
    expect(getLights(state)?.text).toMatch(/next round/);
    expect(state.eventHistory.some(e => e.modifierId === ID && /flicker/.test(e.title))).toBe(true);
    state = chessEngine.applyMove(state, move('h2', 'h3', 'white'));
    state = chessEngine.applyMove(state, move('g8', 'f6', 'black'));
    expect(state.flags.fullMoveNumber).toBe(11);
    expect(isLightsOut(state)).toBe(true);
    // Every piece but the Kings is hidden from the other side.
    expect([...getHiddenPieceIds(state, 'white')].sort()).toEqual(['black-knight-g8', 'black-pawn-a5']);
    expect([...getHiddenPieceIds(state, 'black')].sort()).toEqual(['white-pawn-h2', 'white-rook-a1']);
    state = chessEngine.applyMove(state, move('h3', 'h4', 'white'));
    expect(getHiddenPieceIds(state, 'black').size).toBe(2);
    state = chessEngine.applyMove(state, move('f6', 'g8', 'black'));
    expect(isLightsOut(state)).toBe(false);
    expect(getHiddenPieceIds(state, 'white').size).toBe(0);
    expect(state.eventHistory[state.eventHistory.length - 1].title).toBe('Lights on');
    expect(getLights(state)?.text).toBe('Lights out in 9 rounds');
  });

  it('an illegal blind move is turned down without losing the move', () => {
    const state = start(army(), 11);
    expect(isLightsOut(state)).toBe(true);
    // The rook cannot pass the hidden pawn on a5.
    const next = chessEngine.applyMove(state, move('a1', 'a8', 'white'));
    expect(next.turn).toBe('white');
    expect(next.moveHistory.length).toBe(state.moveHistory.length);
    expect(next.pieces.get('a1')?.type).toBe('rook');
    expect(getHiddenPieceIds(next, 'white').has('black-pawn-a5')).toBe(false);
    expect(chessEngine.applyMove(next, move('a1', 'a5', 'white')).pieces.get('a5')?.color).toBe('white');
  });

  it('Kings are never hidden, and a hidden piece giving check shows', () => {
    const state = start([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('rook', 'black', 'h2'), makePiece('pawn', 'white', 'a2')], 10);
    let next = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    next = chessEngine.applyMove(next, move('h2', 'h1', 'black'));
    // Round 11, lights out, but the rook on h1 checks the King on e1.
    expect(isLightsOut(next)).toBe(true);
    expect(getHiddenPieceIds(next, 'white').has('black-rook-h2')).toBe(false);
    expect(getHiddenPieceIds(next, 'black').has('white-king-e1')).toBe(false);
  });

  it('online, the dark round sends no enemy piece but the King', () => {
    const state = start(army(), 11);
    const seen = redactForViewer(state, 'white');
    expect([...seen.pieces.values()].filter(p => p.color === 'black').map(p => p.type)).toEqual(['king']);
    expect([...seen.pieces.values()].filter(p => p.color === 'white')).toHaveLength(3);
  });

  it('with Night Shift both still count rounds and stack', () => {
    const state = start(army(), 11, [{ id: MODIFIER_IDS.nightShift, sourceColor: null }]);
    expect(isLightsOut(state)).toBe(true);
    expect(getHiddenPieceIds(state, 'white').size).toBe(2);
  });
});

describe('MOD-D016 Jump Scare review cases', () => {
  it('a bump never leaves a false check in view', () => {
    const state = start([makePiece('king', 'white', 'e1'), makePiece('bishop', 'white', 'c4'), makePiece('pawn', 'white', 'h2'),
      makePiece('king', 'black', 'a8'), makePiece('rook', 'black', 'e6'), makePiece('knight', 'black', 'e4')], 11);
    const next = chessEngine.applyMove(state, move('c4', 'f7', 'white'));
    expect(next.turn).toBe('white');
    expect(getHiddenPieceIds(next, 'white').has('black-rook-e6')).toBe(false);
    // The knight blocking the rook's line is shown too, so White does not see a check that is not there.
    expect(getHiddenPieceIds(next, 'white').has('black-knight-e4')).toBe(false);
    expect(chessEngine.getLegalMoves(next, 'h2').length).toBeGreaterThan(0);
  });

  it('a piece shown before the lights go out does not skip the announcement', () => {
    let state = start(army(), 10);
    state = chessEngine.applyMove(state, move('h2', 'h3', 'white'));
    // Another card reveals a piece before Jump Scare's turn start runs.
    const def = modifierRegistry.get(ID)!;
    const pre = def.revealPieces!(state, ['black-pawn-a5']);
    expect((pre.modifierState[ID] as { phase: string }).phase).toBe('warning');
    state = chessEngine.applyMove(state, move('g8', 'f6', 'black'));
    expect(state.eventHistory.some(e => e.title === 'Lights out!')).toBe(true);
  });
});
