import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getAbilityOptions } from '../engine/abilities';
import { getChickBotMove } from '../engine/bot';
import { isInCheck } from '../engine/moveGenerator';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { MODIFIER_IDS } from './ids';
import { getSusPiece } from './definitions/sus';
import { makeEmptyState, makePiece, move } from './testHelpers';

const CAMEL = MODIFIER_IDS.lawrenceOfArabia;

describe('MOD-E011 Lawrence Of Arabia', () => {
  it('turns only the owner\'s knights into Camels', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: CAMEL, sourceColor: 'black' },
    ]);
    const camels = Array.from(state.pieces.values()).filter(p => p.type === 'camel');
    expect(camels.map(p => p.square).sort()).toEqual(['b8', 'g8']);
    expect(camels.every(p => p.color === 'black')).toBe(true);
    expect(state.pieces.get('b1')?.type).toBe('knight');
  });

  it('leaps 3 and 1 over pieces, and stays on one square colour', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('camel', 'white', 'd4'),
      makePiece('pawn', 'white', 'd5'),
      makePiece('pawn', 'white', 'e4'),
      makePiece('pawn', 'white', 'e7'),
      makePiece('rook', 'black', 'g5'),
      makePiece('king', 'black', 'h8'),
    ]);
    const moves = chessEngine.getLegalMoves(state, 'd4').sort();
    // e7 is its own pawn; g5 is a capture.
    expect(moves).toEqual(['a3', 'a5', 'c1', 'c7', 'e1', 'g3', 'g5']);
    const colour = (sq: string) => (sq.charCodeAt(0) + Number(sq[1])) % 2;
    expect(moves.every(sq => colour(sq) === colour('d4'))).toBe(true);
    expect(moves).not.toContain('e6'); // no knight jump
  });

  it('gives check by its leap and writes L in move notation', () => {
    const check = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('camel', 'white', 'd4'),
      makePiece('king', 'black', 'e7'),
    ]);
    expect(isInCheck(check, 'black')).toBe(true);

    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('camel', 'white', 'b1'),
      makePiece('king', 'black', 'h8'),
    ]);
    const next = chessEngine.applyMove(state, move('b1', 'c4', 'white'));
    expect(next.moveHistory[0].notation).toBe('Lc4');
  });

  it('never leaps if that leaves its King in check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'd1'),
      makePiece('camel', 'white', 'd3'),
      makePiece('rook', 'black', 'd8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.getLegalMoves(state, 'd3')).toEqual([]);
    expect(chessEngine.validateMove(state, move('d3', 'e6', 'white')).valid).toBe(false);
  });

  it('bots see and use its leaps', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('camel', 'white', 'd4'),
      makePiece('queen', 'black', 'g5'),
      makePiece('king', 'black', 'h7'),
    ]);
    expect(getChickBotMove(state, 'white', () => 0)).toMatchObject({ from: 'd4', to: 'g5' });
  });

  it('can use Did I Do That? like a knight', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('camel', 'white', 'b1'),
        makePiece('king', 'black', 'e8'),
      ]),
      [{ id: MODIFIER_IDS.didIDoThat, sourceColor: 'white' }],
    );
    expect(getAbilityOptions(state, 'b1')[0].targets).toContain('b5');
  });

  it('is trapped by the Swamp like a knight', () => {
    let state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('camel', 'white', 'c1'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'black', 'a7'),
    ]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.thisIsMySwamp, sourceColor: null }]);
    state = chessEngine.applyMove(state, move('c1', 'd4', 'white'));
    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    expect(chessEngine.validateMove(state, move('d4', 'g5', 'white')).valid).toBe(false);
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('a6', 'a5', 'black'));
    state = chessEngine.applyMove(state, move('a2', 'a1', 'white'));
    state = chessEngine.applyMove(state, move('a5', 'a4', 'black'));
    expect(chessEngine.validateMove(state, move('d4', 'g5', 'white')).valid).toBe(true);
  });

  it('turns Ghost knights into Ghost Camels, whichever card comes first', () => {
    for (const order of [[CAMEL, MODIFIER_IDS.ghosts], [MODIFIER_IDS.ghosts, CAMEL]]) {
      const state = chessEngine.activateDraftModifiers(
        chessEngine.getInitialState(),
        order.map(id => ({ id, sourceColor: 'white' as const })),
      );
      const white = Array.from(state.pieces.values()).filter(p => p.color === 'white');
      expect(white.some(p => p.type === 'knight')).toBe(false);
    }
  });

  it('never lets a Sus disguise pose as a knight, whichever card comes first', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const order of [[CAMEL, MODIFIER_IDS.sus], [MODIFIER_IDS.sus, CAMEL]]) {
        const start = chessEngine.getInitialState();
        start.prngSeed = seed;
        start.prngState = seed;
        const state = chessEngine.activateDraftModifiers(start, order.map(id => ({ id, sourceColor: 'white' as const })));
        const disguise = getSusPiece(state, 'white')!;
        const real = Array.from(state.pieces.values()).find(p => p.id === disguise.pieceId)!;
        expect(disguise.shownAs, `seed ${seed}`).not.toBe('knight');
        expect(disguise.shownAs, `seed ${seed}`).not.toBe(real.type);
      }
    }
  });

  it('cannot be drafted with Hatoful Gambit or The Small Council on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    const card = ALL_MODIFIERS.find(c => c.id === CAMEL)!;
    for (const other of [MODIFIER_IDS.hatofulGambit, MODIFIER_IDS.smallCouncil]) {
      expect(getValidOptions([other], [], built).map(c => c.id)).not.toContain(CAMEL);
      expect(getValidOptions([CAMEL], [], built).map(c => c.id)).not.toContain(other);
      expect(pickBlocker(card, [other], [], built)).toMatch(/^Does not work with /);
      expect(getValidOptions([], [other], built).map(c => c.id)).toContain(CAMEL);
    }
  });
});
