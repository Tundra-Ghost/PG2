import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import type { GameState, Piece } from '../engine/types';
import { redactForViewer } from '../net/redact';
import { getChickBotMove, listBotMoves } from '../engine/bot';
import './index';
import { MODIFIER_IDS } from './ids';
import { getSpoilerBinding, getSpoilerMarks } from './definitions/spoiler-alert';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ID = MODIFIER_IDS.spoilerAlert;

function start(pieces: Piece[], extra: { id: string; sourceColor: 'white' | 'black' | null }[] = []): GameState {
  return chessEngine.beginTurn(chessEngine.activateDraftModifiers(makeEmptyState(pieces), [{ id: ID, sourceColor: null }, ...extra]));
}

const army = () => [makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('knight', 'white', 'b1'),
  makePiece('rook', 'white', 'h1'), makePiece('knight', 'black', 'g8'), makePiece('pawn', 'black', 'a7')];

describe('MOD-D019 Spoiler Alert', () => {
  it('the mark binds the next move, and both players see it', () => {
    let state = start(army());
    state = chessEngine.applyMove(state, move('b1', 'c3', 'white', { spoiler: 'h1' }));
    expect(getSpoilerMarks(state, 'black')).toEqual([{ square: 'h1', color: 'white' }]);
    expect(getSpoilerMarks(state, 'white')).toEqual([{ square: 'h1', color: 'white' }]);
    state = chessEngine.applyMove(state, move('g8', 'f6', 'black', { spoiler: 'a7' }));
    expect(getSpoilerBinding(state, 'white')?.square).toBe('h1');
    const wrong = chessEngine.validateMove(state, move('c3', 'd5', 'white'));
    expect(wrong.valid).toBe(false);
    expect(wrong.reason).toMatch(/rook on h1/);
    expect(chessEngine.validateMove(state, move('h1', 'h4', 'white')).valid).toBe(true);
  });

  it('a mark must be one of your own pieces', () => {
    const state = start(army());
    expect(chessEngine.validateMove(state, move('b1', 'c3', 'white', { spoiler: 'g8' })).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('b1', 'c3', 'white', { spoiler: 'h8' })).valid).toBe(false);
  });

  it('a move with no mark marks the piece that moved', () => {
    let state = start(army());
    state = chessEngine.applyMove(state, move('b1', 'c3', 'white'));
    expect(getSpoilerMarks(state, 'white')).toEqual([{ square: 'c3', color: 'white' }]);
  });

  it('in check, the mark is cancelled', () => {
    const state = start([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('knight', 'white', 'b1'), makePiece('rook', 'black', 'e5')]);
    state.modifierState = { ...state.modifierState, [ID]: { white: 'white-knight-b1' } };
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(getSpoilerBinding(state, 'white')).toBeNull();
    expect(chessEngine.validateMove(state, move('e1', 'd1', 'white')).valid).toBe(true);
  });

  it('if the marked piece has no legal move, any move is allowed', () => {
    let state = start([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('pawn', 'white', 'a2'),
      makePiece('pawn', 'black', 'a3'), makePiece('knight', 'white', 'g1')]);
    // The a2 pawn is blocked by a3.
    state = chessEngine.applyMove(state, move('g1', 'f3', 'white', { spoiler: 'a2' }));
    state = chessEngine.applyMove(state, move('e8', 'd8', 'black'));
    expect(getSpoilerBinding(state, 'white')).toBeNull();
    expect(chessEngine.validateMove(state, move('f3', 'g5', 'white')).valid).toBe(true);
  });

  it('bots obey the mark', () => {
    let state = start(army());
    state = chessEngine.applyMove(state, move('b1', 'c3', 'white', { spoiler: 'b1' }));
    state = chessEngine.applyMove(state, move('g8', 'f6', 'black', { spoiler: 'a7' }));
    state = chessEngine.applyMove(state, move('c3', 'd5', 'white'));
    const moves = listBotMoves(state, 'black');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.from === 'a7')).toBe(true);
  });

  it('online, an enemy mark on a piece out of sight is not sent', () => {
    let state = start(army(), [{ id: MODIFIER_IDS.darkAndScared, sourceColor: null }]);
    state = chessEngine.applyMove(state, move('b1', 'c3', 'white', { spoiler: 'h1' }));
    const seen = redactForViewer(state, 'black');
    expect(getSpoilerMarks(state, 'black')).toEqual([]);
    expect((seen.modifierState[ID] as Record<string, string>).white).toBeUndefined();
    expect((redactForViewer(state, 'white').modifierState[ID] as Record<string, string>).white).toBe('white-rook-h1');
  });

  it('Peer Pressure is judged first: a mark it would block gives way', () => {
    const state = start([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), makePiece('pawn', 'white', 'd4'),
      makePiece('knight', 'black', 'e5'), makePiece('rook', 'white', 'a1')], [{ id: MODIFIER_IDS.peerPressure, sourceColor: 'white' }]);
    state.modifierState = { ...state.modifierState, [ID]: { white: 'white-rook-a1' } };
    expect(getSpoilerBinding(state, 'white')).toBeNull();
    expect(chessEngine.validateMove(state, move('d4', 'e5', 'white')).valid).toBe(true);
  });

  it('online, an enemy move is sent without its mark', () => {
    let state = start(army());
    state = chessEngine.applyMove(state, move('b1', 'c3', 'white', { spoiler: 'h1' }));
    expect(redactForViewer(state, 'black').moveHistory[0].move.spoiler).toBeUndefined();
    expect(redactForViewer(state, 'white').moveHistory[0].move.spoiler).toBe('h1');
  });

  it('bot moves carry a mark of a piece already on the board', () => {
    const state = start(army());
    const botMove = getChickBotMove(state, 'white');
    expect(botMove?.spoiler).toBeDefined();
    expect([...state.pieces.values()].some(p => p.square === botMove!.spoiler && p.color === 'white')).toBe(true);
    expect(chessEngine.validateMove(state, botMove!).valid).toBe(true);
  });

  it('castling counts as a King move', () => {
    const state = start([makePiece('king', 'white', 'e1'), makePiece('rook', 'white', 'h1'), makePiece('king', 'black', 'e8'), makePiece('pawn', 'white', 'a2')]);
    state.flags.castlingRights.white.kingSide = true;
    state.modifierState = { ...state.modifierState, [ID]: { white: 'white-rook-h1' } };
    expect(chessEngine.validateMove(state, move('e1', 'g1', 'white', { isCastle: 'kingside' })).valid).toBe(false);
    state.modifierState = { ...state.modifierState, [ID]: { white: 'white-king-e1' } };
    expect(chessEngine.validateMove(state, move('e1', 'g1', 'white', { isCastle: 'kingside' })).valid).toBe(true);
  });
});
