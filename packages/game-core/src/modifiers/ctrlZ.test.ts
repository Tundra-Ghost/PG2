import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import './index';
import { MODIFIER_IDS } from './ids';
import { canCtrlZ, ctrlZ, ctrlZBlocker } from './definitions/ctrl-z';
import { redactForViewer } from '../net/redact';
import { fromWire, toWire } from '../net/wire';
import { isLagDue } from './definitions/rubber-banding';
import { touchPiece } from './definitions/commitment-issues';
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
    const base = { ...makeEmptyState(PIECES()), ownMoves: { white: 6, black: 6 } };
    let state = chessEngine.beginTurn(chessEngine.activateDraftModifiers(base, [{ id: ID, sourceColor: 'white' }, { id: MODIFIER_IDS.rubberBanding, sourceColor: 'white' }]));
    state = chessEngine.applyMove(state, move('a1', 'a5', 'white'));
    expect(state.pieces.get('a1')).toMatchObject({ type: 'rook' });
    expect(isLagDue(state, 'white')).toBe(false);
    state = chessEngine.applyMove(state, move('b8', 'c6', 'black'));
    const undone = ctrlZ(state);
    expect(isLagDue(undone, 'white')).toBe(true);
  });

  const squares = (state: GameState) => [...state.pieces.values()].map(p => `${p.color}${p.type}@${p.square}`).sort();

  it('a move YOU DIED played is played again the same way after an undo', () => {
    const base = { ...makeEmptyState([...PIECES(), makePiece('knight', 'white', 'g1')]), ownMoves: { white: 5, black: 5 } };
    let state = chessEngine.beginTurn(chessEngine.activateDraftModifiers(base, [{ id: ID, sourceColor: 'white' }, { id: MODIFIER_IDS.youDied, sourceColor: 'white' }]));
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('b8', 'c6', 'black'));
    // White's 7th move was played by a piece on its own.
    expect(state.turn).toBe('black');
    const forced = squares(state);
    state = chessEngine.applyMove(state, move('c6', 'b8', 'black'));
    expect(canCtrlZ(state)).toBe(true);
    const undone = ctrlZ(state);
    expect(undone.turn).toBe('black');
    expect(squares(undone)).toEqual(forced);
  });

  it('an extra turn: no undo halfway, and the undo goes back before both moves', () => {
    let state = start(PIECES());
    state = { ...state, tempoTokens: { ...state.tempoTokens, white: 1 } };
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('b8', 'c6', 'black'));
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white', { extraTurn: true }));
    expect(state.turn).toBe('white');
    expect(ctrlZBlocker(state)).toMatch(/extra move/);
    state = chessEngine.applyMove(state, move('a3', 'a4', 'white'));
    state = chessEngine.applyMove(state, move('c6', 'b8', 'black'));
    const undone = ctrlZ(state);
    expect(undone.pieces.get('a2')).toMatchObject({ type: 'rook' });
    expect(undone.pieces.get('c6')).toMatchObject({ type: 'knight' });
    expect(undone.tempoTokens.white).toBe(1);
  });

  it('a touched piece must be moved: no undo then', () => {
    let state = start(PIECES(), [{ id: MODIFIER_IDS.commitmentIssues, sourceColor: 'white' }]);
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('b8', 'c6', 'black'));
    expect(canCtrlZ(state)).toBe(true);
    const touched = touchPiece(state, 'a2');
    expect(touched).not.toBe(state);
    expect(ctrlZBlocker(touched)).toMatch(/touched/);
  });

  it('both sides may own it: each has its own undo', () => {
    let state = start(PIECES(), [{ id: ID, sourceColor: 'black' }]);
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('b8', 'c6', 'black'));
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    expect(canCtrlZ(state)).toBe(true); // Black's undo
    state = ctrlZ(state);
    expect(state.turn).toBe('black');
    expect(state.pieces.get('a2')).toMatchObject({ type: 'rook' });
    state = chessEngine.applyMove(state, move('b8', 'a6', 'black'));
    state = chessEngine.applyMove(state, move('a2', 'a3', 'white'));
    state = chessEngine.applyMove(state, move('a6', 'b8', 'black'));
    expect(canCtrlZ(state)).toBe(true); // White's undo is still there
    expect(ctrlZBlocker(ctrlZ(state))).toBeDefined();
  });
});
