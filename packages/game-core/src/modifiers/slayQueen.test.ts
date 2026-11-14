import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove } from '../engine/bot';
import { isInCheck } from '../engine/moveGenerator';
import type { GameState, Piece } from '../engine/types';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { traitorDef } from './definitions/traitor';
import { getInfectedReach } from './definitions/cordyceptic-spread';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const AMAZON = MODIFIER_IDS.slayQueen;

function amazon(square: Piece['square'], color: Piece['color'] = 'white'): Piece {
  return { ...makePiece('queen', color, square), isAmazon: true };
}

function withAmazon(pieces: Piece[]): GameState {
  return makeEmptyState(pieces);
}

describe('MOD-E009 Slay Queen (The Amazon)', () => {
  it('makes only the owner\'s starting Queen an Amazon', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: AMAZON, sourceColor: 'white' },
    ]);
    expect(state.pieces.get('d1')?.isAmazon).toBe(true);
    expect(state.pieces.get('d8')?.isAmazon).toBeFalsy();
  });

  it('moves like a queen and also like a knight', () => {
    const state = withAmazon([
      makePiece('king', 'white', 'a1'),
      amazon('d4'),
      makePiece('king', 'black', 'h8'),
    ]);
    const moves = chessEngine.getLegalMoves(state, 'd4');
    expect(moves).toEqual(expect.arrayContaining(['d8', 'h4', 'g7', 'a7', 'e6', 'f5', 'b3', 'c2', 'f3', 'e2', 'c6', 'b5']));
    const plain = withAmazon([
      makePiece('king', 'white', 'a1'),
      makePiece('queen', 'white', 'd4'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.getLegalMoves(plain, 'd4')).not.toContain('e6');
  });

  it('jumps over pieces and captures with a knight move', () => {
    const state = withAmazon([
      makePiece('king', 'white', 'a1'),
      amazon('d4'),
      makePiece('pawn', 'white', 'd5'),
      makePiece('pawn', 'white', 'e5'),
      makePiece('pawn', 'white', 'e4'),
      makePiece('rook', 'black', 'e6'),
      makePiece('king', 'black', 'h8'),
    ]);
    const next = chessEngine.applyMove(state, move('d4', 'e6', 'white'));
    expect(next.pieces.get('e6')).toMatchObject({ type: 'queen', color: 'white', isAmazon: true });
    expect(next.moveHistory[0].notation).toBe('Qxe6');
  });

  it('gives check with a knight move', () => {
    const state = withAmazon([
      makePiece('king', 'white', 'a1'),
      amazon('d4'),
      makePiece('king', 'black', 'e6'),
    ]);
    expect(isInCheck(state, 'black')).toBe(true);
  });

  it('never makes a knight jump that leaves her King in check', () => {
    const state = withAmazon([
      makePiece('king', 'white', 'd1'),
      amazon('d4'),
      makePiece('rook', 'black', 'd8'),
      makePiece('king', 'black', 'h8'),
    ]);
    const moves = chessEngine.getLegalMoves(state, 'd4');
    expect(moves).not.toContain('e6');
    expect(moves).not.toContain('f5');
    expect(chessEngine.validateMove(state, move('d4', 'f5', 'white')).valid).toBe(false);
    expect(moves).toEqual(expect.arrayContaining(['d5', 'd8']));
  });

  it('a promoted queen is a plain queen', () => {
    const state = withAmazon([
      makePiece('king', 'white', 'a1'),
      amazon('h1'),
      makePiece('pawn', 'white', 'b7'),
      makePiece('king', 'black', 'h8'),
    ]);
    const next = chessEngine.applyMove(state, move('b7', 'b8', 'white', { promotion: 'queen' }));
    expect(next.pieces.get('b8')?.isAmazon).toBeFalsy();
  });

  it('bots see and use her knight jumps', () => {
    const state = withAmazon([
      makePiece('king', 'white', 'a1'),
      amazon('d4'),
      makePiece('rook', 'black', 'e6'),
      makePiece('king', 'black', 'h7'),
    ]);
    const botMove = getChickBotMove(state, 'white', () => 0);
    expect(botMove).toMatchObject({ from: 'd4', to: 'e6' });
  });

  it('in the Swamp she is held to one square like every other piece', () => {
    const state = chessEngine.activateDraftModifiers(
      withAmazon([
        makePiece('king', 'white', 'a1'),
        amazon('d4'),
        makePiece('king', 'black', 'h8'),
      ]),
      [{ id: MODIFIER_IDS.thisIsMySwamp, sourceColor: null }],
    );
    expect(chessEngine.validateMove(state, move('d4', 'e6', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d4', 'c3', 'white')).valid).toBe(true);
  });

  it('cannot be drafted with Yeah, There Are Three Of Them on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    const offered = getValidOptions([MODIFIER_IDS.threeKings], [], built).map(card => card.id);
    expect(offered).not.toContain(AMAZON);
    const card = ALL_MODIFIERS.find(c => c.id === AMAZON)!;
    expect(pickBlocker(card, [MODIFIER_IDS.threeKings], [], built)).toMatch(/Does not work with/);
    // The other side may still take it.
    expect(getValidOptions([], [MODIFIER_IDS.threeKings], built).map(c => c.id)).toContain(AMAZON);
  });

  it('a defecting Amazon stays an Amazon for her new side', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: AMAZON, sourceColor: 'white' },
    ]);
    const queen = state.pieces.get('d1')!;
    state.modifierState[MODIFIER_IDS.traitor] = { white: { phase: 'warned', pieceId: queen.id } };
    state.activeModifiers.push({ id: MODIFIER_IDS.traitor, name: 'Traitor', activeFor: 'both', sourceColor: 'white' });
    const defected = traitorDef.onTurnStart!(state);
    expect(defected.pieces.get('d1')).toMatchObject({ color: 'black', isAmazon: true });
  });

  it('infection slows her like a queen: at reach 1 she cannot jump', () => {
    const state = withAmazon([makePiece('king', 'white', 'a1'), amazon('d4'), makePiece('king', 'black', 'h8')]);
    state.activeModifiers = [{ id: MODIFIER_IDS.cordycepticSpread, name: 'Spread', activeFor: 'both', sourceColor: null }];
    state.tiles.set('d4', { square: 'd4', effects: [{ type: 'infected', turnsRemaining: -1 }] });
    state.modifierState[MODIFIER_IDS.cordycepticSpread] = { rot: { [state.pieces.get('d4')!.id]: 6 } };
    expect(getInfectedReach(state, 'd4')).toBe(1);
    expect(chessEngine.validateMove(state, move('d4', 'e6', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('d4', 'd5', 'white')).valid).toBe(true);
  });

  it('a Berserker chain picks the Amazon over a plain queen', () => {
    const state = withAmazon([
      makePiece('king', 'white', 'a1'),
      { ...makePiece('rook', 'white', 'd1'), isBerserker: true },
      makePiece('pawn', 'black', 'd4'),
      makePiece('queen', 'black', 'g4'),
      amazon('d7', 'black'),
      makePiece('king', 'black', 'h8'),
    ]);
    state.activeModifiers = [{ id: MODIFIER_IDS.berserker, name: 'BOY.', activeFor: 'both', sourceColor: 'white' }];
    const next = chessEngine.applyMove(state, move('d1', 'd4', 'white'));
    expect(next.pieces.get('d7')).toMatchObject({ type: 'rook', color: 'white' });
    expect(next.pieces.get('g4')?.type).toBe('queen');
  });
});
