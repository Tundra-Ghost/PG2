import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove, getPigeonBotMove, listBotMoves } from '../engine/bot';
import type { Color, GameState, Piece } from '../engine/types';
import './index';
import { getShooBlocker } from '../engine/gameLoop';
import { getAbilityOptions } from '../engine/abilities';
import { getBlindSpot } from './definitions/known-unknowns';
import { MODIFIER_IDS } from './ids';
import { getForcedPawnCaptures, isUnderPeerPressure } from './definitions/peer-pressure';
import { makeEmptyState, makePiece, move } from './testHelpers';

const PEER = MODIFIER_IDS.peerPressure;

function withPeer(pieces: Piece[], owner: Color = 'white'): GameState {
  return chessEngine.activateDraftModifiers(
    makeEmptyState([makePiece('king', 'white', 'e1'), makePiece('king', 'black', 'e8'), ...pieces]),
    [{ id: PEER, sourceColor: owner }],
  );
}

describe('MOD-B019 Peer Pressure', () => {
  it('forces a pawn capture when one exists', () => {
    const state = withPeer([
      makePiece('pawn', 'white', 'd4'),
      makePiece('knight', 'black', 'e5'),
      makePiece('rook', 'white', 'a1'),
    ]);
    expect(isUnderPeerPressure(state, 'white')).toBe(true);
    const rook = chessEngine.validateMove(state, move('a1', 'a8', 'white'));
    expect(rook.valid).toBe(false);
    expect(rook.reason).toMatch(/Peer Pressure/);
    expect(chessEngine.validateMove(state, move('d4', 'd5', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d4', 'e5', 'white')).valid).toBe(true);
  });

  it('lets you choose which pawn captures', () => {
    const state = withPeer([
      makePiece('pawn', 'white', 'd4'),
      makePiece('pawn', 'white', 'b4'),
      makePiece('knight', 'black', 'e5'),
      makePiece('knight', 'black', 'a5'),
    ]);
    expect(getForcedPawnCaptures(state, 'white')).toHaveLength(2);
    expect(chessEngine.validateMove(state, move('b4', 'a5', 'white')).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('d4', 'e5', 'white')).valid).toBe(true);
  });

  it('counts en passant as a pawn capture', () => {
    let state = withPeer([
      makePiece('pawn', 'white', 'e5'),
      makePiece('pawn', 'black', 'd7'),
      makePiece('rook', 'white', 'a1'),
    ]);
    state.turn = 'black';
    state = chessEngine.applyMove(state, move('d7', 'd5', 'black'));
    expect(isUnderPeerPressure(state, 'white')).toBe(true);
    expect(chessEngine.validateMove(state, move('a1', 'a2', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('e5', 'd6', 'white', { isEnPassant: true })).valid).toBe(true);
  });

  it('only binds the owner', () => {
    const state = withPeer([
      makePiece('pawn', 'black', 'd5'),
      makePiece('knight', 'white', 'e4'),
      makePiece('rook', 'black', 'a8'),
    ]);
    state.turn = 'black';
    expect(isUnderPeerPressure(state, 'black')).toBe(false);
    expect(chessEngine.validateMove(state, move('a8', 'a7', 'black')).valid).toBe(true);
  });

  it('in check, any legal move is allowed', () => {
    const state = withPeer([
      makePiece('pawn', 'white', 'd4'),
      makePiece('knight', 'black', 'c5'),
      makePiece('rook', 'black', 'h1'),
      makePiece('rook', 'white', 'a2'),
    ]);
    expect(chessEngine.isInCheck(state, 'white')).toBe(true);
    expect(isUnderPeerPressure(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('e1', 'e2', 'white')).valid).toBe(true);
  });

  it('a pawn capture that exposes the King does not count', () => {
    const state = withPeer([
      makePiece('pawn', 'white', 'e2'),
      makePiece('bishop', 'black', 'd3'),
      makePiece('rook', 'black', 'e7'),
      makePiece('rook', 'white', 'a1'),
    ]);
    expect(getForcedPawnCaptures(state, 'white')).toEqual([]);
    expect(chessEngine.validateMove(state, move('a1', 'a2', 'white')).valid).toBe(true);
  });

  it('never shoos Gerald while a capture is forced', () => {
    const state = withPeer([
      makePiece('pawn', 'white', 'd4'),
      makePiece('knight', 'black', 'e5'),
      { ...makePiece('rook', 'white', 'a1'), cooldowns: { [MODIFIER_IDS.gerald]: 2 } },
    ]);
    expect(chessEngine.canShooGerald(state)).toBe(false);
    expect(chessEngine.shooGerald(state)).toBe(state);
  });

  it('bots only play pawn captures while pressured', () => {
    const state = withPeer([
      makePiece('pawn', 'white', 'd4'),
      makePiece('pawn', 'white', 'b4'),
      makePiece('pawn', 'black', 'e5'),
      makePiece('queen', 'black', 'a5'),
      makePiece('queen', 'white', 'h1'),
    ]);
    const moves = listBotMoves(state, 'white');
    expect(moves.map(m => `${m.from}${m.to}`).sort()).toEqual(['b4a5', 'd4e5']);
    expect(chessEngine.validateMove(state, getChickBotMove(state, 'white', () => 0)!).valid).toBe(true);
    expect(chessEngine.validateMove(state, getPigeonBotMove(state, 'white', { depth: 2 })!).valid).toBe(true);
  });

  it('Conscientious Objector: the pacifist pawn is exempt', () => {
    const state = withPeer([
      { ...makePiece('pawn', 'white', 'd4'), isPacifist: true },
      makePiece('knight', 'black', 'e5'),
      makePiece('rook', 'white', 'a1'),
    ]);
    state.activeModifiers.push({ id: MODIFIER_IDS.conscientiousObjector, name: 'CO', activeFor: 'both', sourceColor: 'white' });
    expect(isUnderPeerPressure(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('a1', 'a2', 'white')).valid).toBe(true);
  });

  it('never softlocks: forced only when a legal capture exists', () => {
    const state = withPeer([makePiece('pawn', 'white', 'd4'), makePiece('knight', 'black', 'e5')]);
    expect(chessEngine.hasAnyValidMove(state)).toBe(true);
    const next = chessEngine.applyMove(state, move('d4', 'e5', 'white'));
    expect(next.status).toBe('active');
  });

  it('says why Gerald cannot be shooed', () => {
    const state = withPeer([
      makePiece('pawn', 'white', 'd4'),
      makePiece('knight', 'black', 'e5'),
      { ...makePiece('rook', 'white', 'a1'), cooldowns: { [MODIFIER_IDS.gerald]: 2 } },
    ]);
    expect(getShooBlocker(state)).toMatch(/Peer Pressure/);
  });

  it('Reject Queen: a capture that can only promote to a rook still forces you', () => {
    const state = withPeer([
      makePiece('pawn', 'white', 'b7'),
      makePiece('rook', 'black', 'c8'),
      makePiece('rook', 'white', 'a1'),
    ]);
    state.activeModifiers.push({ id: MODIFIER_IDS.rejectQueen, name: 'RQ', activeFor: 'both', sourceColor: 'white' });
    expect(isUnderPeerPressure(state, 'white')).toBe(true);
    expect(chessEngine.validateMove(state, move('b7', 'c8', 'white', { promotion: 'queen' })).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('b7', 'c8', 'white', { promotion: 'rook' })).valid).toBe(true);
    expect(chessEngine.validateMove(state, move('a1', 'a2', 'white')).valid).toBe(false);
  });

  it('Moneyball: no drops while a capture is forced, for players or bots', () => {
    const state = withPeer([
      makePiece('pawn', 'white', 'd4'),
      makePiece('knight', 'black', 'e5'),
    ]);
    state.activeModifiers.push({ id: MODIFIER_IDS.moneyball, name: 'Moneyball', activeFor: 'both', sourceColor: 'white' });
    state.modifierState[MODIFIER_IDS.moneyball] = { white: { tokens: 1, pool: ['knight'] } };
    const drop = move('e1', 'a3', 'white', { ability: MODIFIER_IDS.moneyball, dropType: 'knight' });
    expect(chessEngine.validateMove(state, drop).valid).toBe(false);
    expect(getAbilityOptions(state, 'e1').every(option => option.targets.length === 0)).toBe(true);
    expect(listBotMoves(state, 'white').every(m => !m.ability)).toBe(true);
  });

  it('under fog, a hidden enemy piece never forces a capture', () => {
    let state = withPeer([makePiece('rook', 'white', 'h1')]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.knownUnknowns, sourceColor: null }]);
    const blind = new Set(getBlindSpot(state, 'white'));
    const target = [...blind].find(sq => {
      const pawn = `${String.fromCharCode(sq.charCodeAt(0) - 1)}${Number(sq[1]) - 1}`;
      return sq[0] !== 'a' && sq[1] !== '1' && !blind.has(pawn as never) && !state.pieces.has(pawn as never) && !state.pieces.has(sq);
    })!;
    const pawnSq = `${String.fromCharCode(target.charCodeAt(0) - 1)}${Number(target[1]) - 1}` as typeof target;
    state.pieces.set(pawnSq, makePiece('pawn', 'white', pawnSq));
    state.pieces.set(target, makePiece('knight', 'black', target));
    expect(isUnderPeerPressure(state, 'white')).toBe(false);
    expect(chessEngine.validateMove(state, move('h1', 'h2', 'white')).valid).toBe(true);
    // The capture itself is still allowed.
    expect(chessEngine.validateMove(state, move(pawnSq, target, 'white')).valid).toBe(true);
  });
});
