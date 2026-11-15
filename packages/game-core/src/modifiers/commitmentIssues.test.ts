import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove, listBotMoves } from '../engine/bot';
import { getShooBlocker } from '../engine/gameLoop';
import type { Color, GameState, Piece } from '../engine/types';
import { fromWire, toWire } from '../net/wire';
import './index';
import { MODIFIER_IDS } from './ids';
import { getTouchedPiece, touchPiece } from './definitions/commitment-issues';
import { makeEmptyState, makePiece, move } from './testHelpers';

const TOUCH = MODIFIER_IDS.commitmentIssues;

function withTouch(pieces: Piece[], owner: Color = 'white'): GameState {
  return chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), ...pieces]),
    [{ id: TOUCH, sourceColor: owner }],
  );
}

describe('MOD-B015 Commitment Issues', () => {
  it('a touched piece must move', () => {
    let state = withTouch([makePiece('knight', 'white', 'g1'), makePiece('rook', 'white', 'a1')]);
    state = touchPiece(state, 'g1');
    expect(getTouchedPiece(state, 'white')?.square).toBe('g1');
    const rook = chessEngine.validateMove(state, move('a1', 'a2', 'white'));
    expect(rook.valid).toBe(false);
    expect(rook.reason).toBe('Commitment Issues: you touched the knight on g1. You must move it.');
    expect(chessEngine.validateMove(state, move('g1', 'f3', 'white')).valid).toBe(true);
  });

  it('a second touch changes nothing', () => {
    let state = withTouch([makePiece('knight', 'white', 'g1'), makePiece('rook', 'white', 'a1')]);
    state = touchPiece(state, 'g1');
    expect(touchPiece(state, 'a1')).toBe(state);
  });

  it('touching a piece with no legal move does not count', () => {
    const state = withTouch([
      makePiece('bishop', 'white', 'c1'),
      makePiece('pawn', 'white', 'b2'),
      makePiece('pawn', 'white', 'd2'),
      makePiece('rook', 'white', 'a1'),
    ]);
    expect(touchPiece(state, 'c1')).toBe(state);
    // A pinned piece has no legal move either.
    const pinned = withTouch([makePiece('knight', 'white', 'e2'), makePiece('rook', 'black', 'e7')]);
    expect(touchPiece(pinned, 'e2')).toBe(pinned);
  });

  it('only binds the owner, and only on their turn', () => {
    const state = withTouch([makePiece('knight', 'white', 'g1'), makePiece('knight', 'black', 'g8')], 'black');
    expect(touchPiece(state, 'g1')).toBe(state);
    expect(touchPiece(state, 'g8')).toBe(state); // not black's turn
  });

  it('the touch clears once the move is made', () => {
    let state = withTouch([makePiece('knight', 'white', 'g1'), makePiece('pawn', 'black', 'a7')]);
    state = touchPiece(state, 'g1');
    state = chessEngine.applyMove(state, move('g1', 'f3', 'white'));
    expect(Array.from(state.pieces.values()).some(p => p.isTouched)).toBe(false);
    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    expect(chessEngine.validateMove(state, move('e1', 'e2', 'white')).valid).toBe(true);
  });

  it('in check, a touched piece that can block or take must do so', () => {
    let state = withTouch([
      makePiece('rook', 'white', 'a2'),
      makePiece('knight', 'white', 'b1'),
      makePiece('rook', 'black', 'e5'),
    ]);
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    // The b1 knight cannot help, so touching it does not count.
    expect(touchPiece(state, 'b1')).toBe(state);
    state = touchPiece(state, 'a2');
    expect(chessEngine.validateMove(state, move('e1', 'd1', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('a2', 'e2', 'white')).valid).toBe(true);
  });

  it('no Gerald shoo after a touch', () => {
    let state = withTouch([
      makePiece('knight', 'white', 'g1'),
      { ...makePiece('rook', 'white', 'a1'), cooldowns: { [MODIFIER_IDS.gerald]: 2 } },
    ]);
    expect(chessEngine.canShooGerald(state)).toBe(true);
    state = touchPiece(state, 'g1');
    expect(chessEngine.canShooGerald(state)).toBe(false);
    expect(getShooBlocker(state)).toMatch(/Commitment Issues/);
  });

  it('survives the trip to and from the server', () => {
    const state = touchPiece(withTouch([makePiece('knight', 'white', 'g1'), makePiece('rook', 'white', 'a1')]), 'g1');
    const back = fromWire(JSON.parse(JSON.stringify(toWire(state))));
    expect(chessEngine.validateMove(back, move('a1', 'a2', 'white')).valid).toBe(false);
  });

  it('bots only list moves of a touched piece and never play an illegal move', () => {
    let state = withTouch([makePiece('knight', 'white', 'g1'), makePiece('rook', 'white', 'a1'), makePiece('queen', 'black', 'a8')]);
    state = touchPiece(state, 'g1');
    expect(listBotMoves(state, 'white').every(m => m.from === 'g1')).toBe(true);
    const botMove = getChickBotMove(state, 'white', () => 0)!;
    expect(chessEngine.validateMove(state, botMove).valid).toBe(true);
  });

  it('a bot that owns the card plays freely, since it never touches', () => {
    const state = withTouch([makePiece('rook', 'white', 'a1'), makePiece('queen', 'black', 'a8')]);
    expect(getChickBotMove(state, 'white', () => 0)).toMatchObject({ from: 'a1', to: 'a8' });
  });

  it('Peer Pressure: a piece that cannot move under pressure cannot be touched', () => {
    let state = withTouch([
      makePiece('pawn', 'white', 'd4'),
      makePiece('knight', 'black', 'e5'),
      makePiece('rook', 'white', 'a1'),
    ]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.peerPressure, sourceColor: 'white' }]);
    expect(touchPiece(state, 'a1')).toBe(state);
    state = touchPiece(state, 'd4');
    expect(getTouchedPiece(state, 'white')?.square).toBe('d4');
    expect(chessEngine.validateMove(state, move('d4', 'e5', 'white')).valid).toBe(true);
  });
});
