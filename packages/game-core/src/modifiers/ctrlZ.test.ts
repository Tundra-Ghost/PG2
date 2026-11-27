import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { canCtrlZ, ctrlZ, ctrlZBlocker } from './definitions/ctrl-z';
import { redactForViewer } from '../net/redact';
import { fromWire, toWire } from '../net/wire';
import { isLagDue } from './definitions/rubber-banding';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.ctrlZ;

function start(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' }[] = []): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: ID, sourceColor: 'white' }, ...extra]));
}

const PIECES = () => [makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('rook', 'white', 'a1'), makePiece('knight', 'black', 'b8')];

describe('MOD-C015 Ctrl+Z', () => {
  it('needs a finished round first', () => {
    const state = start(PIECES());
    expect(canCtrlZ(state)).toBe(false);
    expect(ctrlZBlocker(state)).toMatch(/make a move first/);
    expect(ctrlZ(state)).toBe(state);
  });

  it('undoes your last move and the reply, then you move again; once per match', () => {
    const before = start(PIECES());
    let state = chessEngine.applyMove(before, move('a1', 'a5', 'white'));
    expect(canCtrlZ(state)).toBe(false); // Black's turn: only the owner, on its turn.
    state = chessEngine.applyMove(state, move('b8', 'c6', 'black'));
    expect(canCtrlZ(state)).toBe(true);
    const undone = ctrlZ(state);
    expect(undone.turn).toBe('white');
    expect(undone.moveHistory).toHaveLength(0);
    expect(undone.pieces.get('a1')).toMatchObject({ type: 'rook' });
    expect(undone.pieces.get('b8')).toMatchObject({ type: 'knight' });
    expect(undone.prngState).toBe(before.prngState);
    expect(undone.eventHistory[undone.eventHistory.length - 1]).toMatchObject({ modifierId: ID, title: 'CTRL+Z' });
    // Used up for the rest of the match.
    let later = chessEngine.applyMove(undone, move('a1', 'a4', 'white'));
    later = chessEngine.applyMove(later, move('b8', 'a6', 'black'));
    expect(canCtrlZ(later)).toBe(false);
    expect(ctrlZBlocker(later)).toMatch(/used up/);
  });

  it('keeps the seed: the same moves bring the same random events', () => {
    const lava = [{ id: MODIFIER_IDS.floorIsLava, sourceColor: 'black' as const }];
    let state = start(PIECES(), lava);
    state = chessEngine.applyMove(state, move('a1', 'a5', 'white'));
    state = chessEngine.applyMove(state, move('b8', 'c6', 'black'));
    const first = chessEngine.applyMove(state, move('a5', 'a6', 'white'));
    const undone = ctrlZ(state);
    let again = chessEngine.applyMove(undone, move('a1', 'a5', 'white'));
    again = chessEngine.applyMove(again, move('b8', 'c6', 'black'));
    expect(again.prngState).toBe(state.prngState);
    expect([...again.tiles.entries()]).toEqual([...state.tiles.entries()]);
    expect(chessEngine.applyMove(again, move('a5', 'a6', 'white')).prngState).toBe(first.prngState);
  });

  it('cannot undo a round that ended the game', () => {
    // White mates in one with the rook; then the game is over.
    let state = start([makePiece('king', 'white', 'g6'), makePiece('rook', 'white', 'a1'), makePiece('king', 'black', 'h8'), makePiece('pawn', 'black', 'a7')]);
    state = chessEngine.applyMove(state, move('a1', 'b1', 'white'));
    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    state = chessEngine.applyMove(state, move('b1', 'b8', 'white'));
    expect(state.status).toBe('checkmate');
    expect(canCtrlZ({ ...state, turn: 'white' })).toBe(false);
  });

  it('only the owner can use it', () => {
    let state = start(PIECES());
    state = chessEngine.applyMove(state, move('a1', 'a5', 'white'));
    expect(ctrlZBlocker(state)).toMatch(/not yours/);
  });

  it('online: the snapshot is never sent, and the state survives the wire', () => {
    let state = start(PIECES());
    state = chessEngine.applyMove(state, move('a1', 'a5', 'white'));
    state = chessEngine.applyMove(state, move('b8', 'c6', 'black'));
    const forWhite = redactForViewer(state, 'white');
    expect(forWhite.modifierState[ID]).toEqual({ white: { ready: true } });
    expect(canCtrlZ(forWhite)).toBe(true);
    expect(JSON.stringify(redactForViewer(state, 'black').modifierState[ID])).not.toContain('pieces');
    const wired = fromWire(JSON.parse(JSON.stringify(toWire(state))));
    const undone = ctrlZ(wired);
    expect(undone.pieces.get('a1')).toMatchObject({ type: 'rook' });
    expect(undone.pieces instanceof Map).toBe(true);
  });

  it('interaction: Rubber Banding. Undoing a lagged move brings the lag back', () => {
    let state = start(PIECES(), [{ id: MODIFIER_IDS.rubberBanding, sourceColor: 'white' }]);
    state = { ...state, ownMoves: { white: 6, black: 6 } };
    state = chessEngine.applyMove(state, move('a1', 'a5', 'white'));
    expect(state.pieces.get('a1')).toMatchObject({ type: 'rook' });
    expect(isLagDue(state, 'white')).toBe(false);
    state = chessEngine.applyMove(state, move('b8', 'c6', 'black'));
    const undone = ctrlZ(state);
    expect(isLagDue(undone, 'white')).toBe(true);
  });
});
