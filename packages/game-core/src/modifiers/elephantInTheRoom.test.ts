import { describe, expect, it } from 'vitest';
import { chessEngine } from '../engine/ChessEngine';
import { getChickBotMove } from '../engine/bot';
import { isInCheck } from '../engine/moveGenerator';
import { getValidOptions, pickBlocker } from '../draft/rules';
import { ALL_MODIFIERS } from './data';
import { modifierRegistry } from './registry';
import './index';
import { MODIFIER_IDS } from './ids';
import { makeEmptyState, makePiece, move } from './testHelpers';

const ELEPHANT = MODIFIER_IDS.elephantInTheRoom;

describe('MOD-E020 Elephant In The Room', () => {
  it('turns only the owner\'s bishops into Elephants', () => {
    const state = chessEngine.activateDraftModifiers(chessEngine.getInitialState(), [
      { id: ELEPHANT, sourceColor: 'white' },
    ]);
    const elephants = Array.from(state.pieces.values()).filter(p => p.type === 'elephant');
    expect(elephants.map(p => p.square).sort()).toEqual(['c1', 'f1']);
    expect(elephants.every(p => p.color === 'white')).toBe(true);
    expect(state.pieces.get('c8')?.type).toBe('bishop');
    expect(state.pieces.get('f8')?.type).toBe('bishop');
  });

  it('jumps exactly two squares diagonally, over pieces', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('elephant', 'white', 'd4'),
      makePiece('pawn', 'white', 'e5'),
      makePiece('pawn', 'black', 'c3'),
      makePiece('knight', 'black', 'b2'),
      makePiece('pawn', 'white', 'f2'),
      makePiece('king', 'black', 'h8'),
    ]);
    // b6 empty, f6 over own pawn, b2 capture over enemy pawn; f2 own piece.
    expect(chessEngine.getLegalMoves(state, 'd4').sort()).toEqual(['b2', 'b6', 'f6']);
  });

  it('cannot move one square or slide further', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('elephant', 'white', 'c1'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.getLegalMoves(state, 'c1').sort()).toEqual(['a3', 'e3']);
    expect(chessEngine.validateMove(state, move('c1', 'd2', 'white')).valid).toBe(false);
    expect(chessEngine.validateMove(state, move('c1', 'f4', 'white')).valid).toBe(false);
  });

  it('gives check by its jump and writes E in move notation', () => {
    const check = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('elephant', 'white', 'd4'),
      makePiece('pawn', 'black', 'e5'),
      makePiece('king', 'black', 'f6'),
    ]);
    expect(isInCheck(check, 'black')).toBe(true);

    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('elephant', 'white', 'c1'),
      makePiece('king', 'black', 'h8'),
    ]);
    const next = chessEngine.applyMove(state, move('c1', 'e3', 'white'));
    expect(next.moveHistory[0].notation).toBe('Ee3');
  });

  it('never jumps if that leaves its King in check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'd1'),
      makePiece('elephant', 'white', 'd3'),
      makePiece('rook', 'black', 'd8'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(chessEngine.getLegalMoves(state, 'd3')).toEqual([]);
    expect(chessEngine.validateMove(state, move('d3', 'f5', 'white')).valid).toBe(false);
  });

  it('can be captured, and cannot step in to block a check', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('elephant', 'white', 'c3'),
      makePiece('bishop', 'black', 'a5'),
      makePiece('king', 'black', 'h8'),
    ]);
    state.turn = 'black';
    expect(chessEngine.getLegalMoves(state, 'a5')).toContain('c3');
    // The Elephant cannot step to d2 to block a check from a5 to e1.
    const checked = makeEmptyState([
      makePiece('king', 'white', 'e1'),
      makePiece('elephant', 'white', 'c1'),
      makePiece('bishop', 'black', 'a5'),
      makePiece('king', 'black', 'h8'),
    ]);
    expect(isInCheck(checked, 'white')).toBe(true);
    expect(chessEngine.getLegalMoves(checked, 'c1')).toEqual([]);
  });

  it('bots see and use its jumps', () => {
    const state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('elephant', 'white', 'd4'),
      makePiece('rook', 'black', 'f6'),
      makePiece('king', 'black', 'h7'),
    ]);
    expect(getChickBotMove(state, 'white', () => 0)).toMatchObject({ from: 'd4', to: 'f6' });
  });

  it('is not a bishop for Twin Telepathy', () => {
    const state = chessEngine.activateDraftModifiers(
      makeEmptyState([
        makePiece('king', 'white', 'e1'),
        makePiece('bishop', 'white', 'c1'),
        makePiece('elephant', 'white', 'f1'),
        makePiece('king', 'black', 'e8'),
        makePiece('pawn', 'black', 'a7'),
      ]),
      [{ id: MODIFIER_IDS.twinTelepathy, sourceColor: null }],
    );
    const next = chessEngine.applyMove(state, move('c1', 'e3', 'white'));
    expect(next.pieces.get('f1')?.type).toBe('elephant');
  });

  it('is trapped by the Swamp like a knight, then jumps out', () => {
    let state = makeEmptyState([
      makePiece('king', 'white', 'a1'),
      makePiece('elephant', 'white', 'b2'),
      makePiece('king', 'black', 'h8'),
      makePiece('pawn', 'black', 'a7'),
    ]);
    state = chessEngine.activateDraftModifiers(state, [{ id: MODIFIER_IDS.thisIsMySwamp, sourceColor: null }]);
    state = chessEngine.applyMove(state, move('b2', 'd4', 'white'));
    expect(state.pieces.get('d4')?.cooldowns[MODIFIER_IDS.thisIsMySwamp]).toBeGreaterThan(0);
    state = chessEngine.applyMove(state, move('a7', 'a6', 'black'));
    expect(chessEngine.validateMove(state, move('d4', 'f6', 'white')).valid).toBe(false);
    state = chessEngine.applyMove(state, move('a1', 'a2', 'white'));
    state = chessEngine.applyMove(state, move('a6', 'a5', 'black'));
    state = chessEngine.applyMove(state, move('a2', 'a1', 'white'));
    state = chessEngine.applyMove(state, move('a5', 'a4', 'black'));
    expect(chessEngine.validateMove(state, move('d4', 'f6', 'white')).valid).toBe(true);
  });

  it('turns Ghost bishops into Ghost Elephants, whichever card comes first', () => {
    for (const order of [[ELEPHANT, MODIFIER_IDS.ghosts], [MODIFIER_IDS.ghosts, ELEPHANT]]) {
      const state = chessEngine.activateDraftModifiers(
        chessEngine.getInitialState(),
        order.map(id => ({ id, sourceColor: 'white' as const })),
      );
      const white = Array.from(state.pieces.values()).filter(p => p.color === 'white');
      expect(white.some(p => p.type === 'bishop')).toBe(false);
    }
  });

  it('cannot be drafted with Holy Knight, The Small Council or Forgive Me on the same side', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    const card = ALL_MODIFIERS.find(c => c.id === ELEPHANT)!;
    for (const other of [MODIFIER_IDS.holyKnight, MODIFIER_IDS.smallCouncil, MODIFIER_IDS.forgiveMe]) {
      expect(getValidOptions([other], [], built).map(c => c.id)).not.toContain(ELEPHANT);
      expect(getValidOptions([ELEPHANT], [], built).map(c => c.id)).not.toContain(other);
      expect(pickBlocker(card, [other], [], built)).toMatch(/^Does not work with /);
      expect(getValidOptions([], [other], built).map(c => c.id)).toContain(ELEPHANT);
    }
  });

  it('is offered in the draft and pays back a point', () => {
    const built = new Set(modifierRegistry.getAll().map(def => def.id));
    expect(built.has(ELEPHANT)).toBe(true);
    expect(ALL_MODIFIERS.find(c => c.id === ELEPHANT)).toMatchObject({ cost: -1, curseLevel: 1 });
  });
});
