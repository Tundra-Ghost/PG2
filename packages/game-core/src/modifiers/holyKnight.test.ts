import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove } from '../engine/bot';
import { isInCheck } from '../engine/moveGenerator';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { isInfectedSquare } from './definitions/cordyceptic-spread';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const HOLY = MODIFIER_IDS.holyKnight;

describe('MOD-E010 Holy Knight (The Archbishop)', () => {
  it('turns one random owner bishop into an Archbishop', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: HOLY, sourceColor: 'white' },
    ]);
    const arch = Array.from(state.pieces.values()).filter(p => p.type === 'archbishop');
    expect(arch).toHaveLength(1);
    expect(arch[0].color).toBe('white');
    expect(['c1', 'f1']).toContain(arch[0].square);
    expect(Array.from(state.pieces.values()).filter(p => p.type === 'bishop')).toHaveLength(3);
    // Castling is untouched.
    expect(state.flags.castlingRights.white).toEqual({ kingSide: true, queenSide: true });
  });

  it('picks the same bishop for the same seed', () => {
    const pick = () => {
      const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [{ id: HOLY, sourceColor: 'black' }]);
      return Array.from(state.pieces.values()).find(p => p.type === 'archbishop')!.square;
    };
    expect(pick()).toBe(pick());
  });

  it('moves like a bishop or a knight, never like a rook', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('archbishop', 'white', 'd4'),
      makePiece('king', 'black', 'h8'),
    ]);
    const moves = chessEngine.getLegalMoves(state, 'd4');
    expect(moves).toEqual(expect.arrayContaining(['g7', 'a7', 'g1', 'e6', 'f5', 'b3', 'c2', 'f3', 'e2', 'c6', 'b5']));
    expect(moves).not.toContain('d5');
    expect(moves).not.toContain('h4');
  });

  it('gives check like a knight and writes A in move notation', () => {
    const check = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('archbishop', 'white', 'd4'),
      makePiece('king', 'black', 'e6'),
    ]);
    expect(isInCheck(check, 'black')).toBe(true);

    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('archbishop', 'white', 'd4'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'black', 'a7'),
    ]);
    const next = chessEngine.applyMove(state, move('d4', 'f5', 'white'));
    expect(next.moveHistory[0].notation).toBe('Af5');
  });

  it('never makes a knight jump that leaves its King in check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'd1'),
      makePiece('archbishop', 'white', 'd4'),
      makePiece('rook', 'black', 'd8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.getLegalMoves(state, 'd4')).toEqual([]);
    expect(chessEngine.validateMove(state, move('d4', 'e6', 'white')).valid).toBe(false);
  });

  it('bots see and use its knight jumps', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('archbishop', 'white', 'd4'),
      makePiece('rook', 'black', 'e6'),
      makePiece('king', 'black', 'h7'),
    ]);
    expect(getChickBotMove(state, 'white', () => 0)).toMatchObject({ from: 'd4', to: 'e6' });
  });

  it('is not a bishop for Twin Telepathy', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('archbishop', 'white', 'c1'),
        makePiece('bishop', 'white', 'f1'),
        makePiece('king', 'black', 'e8'),
        makePiece('pawn', 'black', 'a7'),
      ]),
      [{ id: MODIFIER_IDS.twinTelepathy, sourceColor: null }],
    );
    const next = chessEngine.applyMove(state, move('c1', 'e3', 'white'));
    expect(next.pieces.get('f1')?.type).toBe('bishop');
  });

  it('cannot be drafted with The Small Council on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    expect(getValidOptions([MODIFIER_IDS.smallCouncil], [], built).map(c => c.id)).not.toContain(HOLY);
    const card = ALL_MODIFIERS.find(c => c.id === HOLY)!;
    expect(pickBlocker(card, [MODIFIER_IDS.smallCouncil], [], built)).toBe('Does not work with The Small Council.');
    expect(getValidOptions([], [MODIFIER_IDS.smallCouncil], built).map(c => c.id)).toContain(HOLY);
  });

  it('never turns a Ghost bishop into the Archbishop', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const start = chessEngine.getInitialState();
      start.prngSeed = seed;
      start.prngState = seed;
      const state = chessEngine.activateDraftModifiers(start, [
        { id: MODIFIER_IDS.ghosts, sourceColor: 'white' },
        { id: HOLY, sourceColor: 'white' },
      ]);
      const arch = Array.from(state.pieces.values()).find(p => p.type === 'archbishop')!;
      expect(arch.isGhost, `seed ${seed}`).toBeFalsy();
      expect(['c1', 'f1']).toContain(arch.square);
    }
  });

  it('does not clear infection when it crosses an infected square', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('archbishop', 'white', 'c1'),
      makePiece('king', 'black', 'h8'),
    ]);
    state.activeModifiers = [{ id: MODIFIER_IDS.cordycepticSpread, name: 'Spread', activeFor: 'both', sourceColor: null }];
    state.tiles.set('d2', { square: 'd2', effects: [{ type: 'infected', turnsRemaining: -1 }] });
    const next = chessEngine.applyMove(state, move('c1', 'e3', 'white'));
    expect(isInfectedSquare(next, 'd2')).toBe(true);
  });
});
